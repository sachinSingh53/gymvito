import { AppState, type AppStateStatus } from 'react-native';
import type { File } from 'expo-file-system';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  deleteGymVitoDatabaseFiles,
  openGymVitoDatabase,
  type OpenedDatabase,
} from '@/data/database/open-database';
import { AppStateRepository, type StartupSnapshot } from '@/data/repositories/app-state-repository';
import { Phase2Repository } from '@/data/repositories/phase2-repository';
import { Phase3Repository } from '@/data/repositories/phase3-repository';
import { Phase4Repository } from '@/data/repositories/phase4-repository';
import type { AppLanguage, GymSetupInput, OnboardingStep } from '@/domain/onboarding/onboarding';
import { SecurityService, type UnlockResult } from '@/features/security/security-service';
import { BackupService, type SavedBackup } from '@/features/backup-restore/backup-service';
import i18n, { setAppLanguage } from '@/i18n';
import { logLocalDiagnostic } from '@/platform/diagnostics/local-diagnostic-logger';
import {
  observeDeviceLocale,
  readDeviceLocale,
  type DeviceLocaleSnapshot,
} from '@/platform/localization/device-locale';
import { getRuntimeCapabilities } from '@/platform/runtime/runtime-capabilities';
import { authenticateWithBiometrics, canUseBiometrics } from '@/platform/security/biometrics';
import { createPinVerifier } from '@/platform/security/pin-kdf';
import type { BackupManifest } from '@/platform/backup/backup-manifest';
import { recoverEncryptedBackup, verifyEncryptedBackup } from '@/platform/backup/sqlcipher-backup';
import {
  deleteDatabaseKey,
  getOrCreateRecoveryDatabaseKey,
} from '@/platform/secure-storage/database-key';
import { Phase5Repository } from '@/data/repositories/phase5-repository';

type ReadyBase = Readonly<{
  schemaVersion: number;
  snapshot: StartupSnapshot;
  deviceLocale: DeviceLocaleSnapshot;
}>;

export type AppSessionState =
  | { status: 'initializing' }
  | { status: 'migrating' }
  | ({ status: 'setup-required'; step: OnboardingStep } & ReadyBase)
  | ({ status: 'locked' } & ReadyBase)
  | ({ status: 'unlocked'; ownerId: string; ownerName: string } & ReadyBase)
  | { status: 'recovery-error'; messageCode: string };

type AppSessionContextValue = Readonly<{
  state: AppSessionState;
  chooseLanguage(language: AppLanguage): Promise<void>;
  saveGym(input: GymSetupInput): Promise<void>;
  updateGym(input: GymSetupInput): Promise<void>;
  saveSecurity(pin: string, biometricsEnabled: boolean): Promise<void>;
  completeOnboarding(): Promise<void>;
  unlockWithPin(pin: string): Promise<UnlockResult>;
  unlockWithBiometrics(): Promise<'success' | 'fallback-to-pin'>;
  reauthenticateOwner(pin: string): Promise<boolean>;
  lock(reason?: 'manual' | 'inactivity' | 'background'): Promise<void>;
  changeLanguage(language: AppLanguage): Promise<void>;
  changeInactivityTimeout(seconds: number): Promise<void>;
  recordActivity(): void;
  retryStartup(): void;
  getPhase2Repository(): Phase2Repository;
  getPhase3Repository(): Phase3Repository;
  getPhase4Repository(): Phase4Repository;
  getBackupService(): BackupService;
  createBackup(passphrase: string, ownerPin: string): Promise<SavedBackup>;
  previewBackup(file: File, passphrase: string): Promise<BackupManifest>;
  restoreBackup(file: File, passphrase: string, ownerPin: string): Promise<BackupManifest>;
  deleteAllLocalData(ownerPin: string): Promise<boolean>;
  previewRecoveryBackup(file: File, passphrase: string): Promise<BackupManifest>;
  recoverFromBackup(file: File, passphrase: string): Promise<BackupManifest>;
}>;

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

function diagnosticCode(error: unknown): string {
  if (!(error instanceof Error)) return 'SESSION.UNKNOWN_ERROR';
  const code = error.message
    .replace(/[^A-Za-z0-9_.-]/g, '_')
    .toUpperCase()
    .slice(0, 60);
  return code || 'SESSION.UNKNOWN_ERROR';
}

export function AppSessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppSessionState>({ status: 'initializing' });
  const [startupAttempt, setStartupAttempt] = useState(0);
  const openedRef = useRef<OpenedDatabase | null>(null);
  const repositoryRef = useRef<AppStateRepository | null>(null);
  const stateRef = useRef(state);
  const lastActivityAtRef = useRef(0);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const requireRepository = useCallback((): AppStateRepository => {
    if (!repositoryRef.current) throw new Error('SESSION_NOT_READY');
    return repositoryRef.current;
  }, []);

  const readyState = useCallback(
    (snapshot: StartupSnapshot, opened: OpenedDatabase): AppSessionState => {
      const ready = {
        schemaVersion: opened.schemaVersion,
        snapshot,
        deviceLocale: readDeviceLocale(),
      };
      return snapshot.setupComplete
        ? { status: 'locked', ...ready }
        : { status: 'setup-required', step: snapshot.onboardingStep, ...ready };
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const migrationMarker = setTimeout(() => {
      if (active) setState({ status: 'migrating' });
    }, 0);
    void (async () => {
      try {
        const opened = await openGymVitoDatabase();
        const repository = new AppStateRepository(opened.database);
        const snapshot = await repository.loadStartupSnapshot();
        await setAppLanguage(snapshot.settings?.language ?? 'en');
        if (!active) {
          await opened.database.closeAsync();
          return;
        }
        openedRef.current = opened;
        repositoryRef.current = repository;
        setState(readyState(snapshot, opened));
      } catch (error) {
        const code = diagnosticCode(error);
        logLocalDiagnostic('error', `STARTUP.${code}`);
        if (active) setState({ status: 'recovery-error', messageCode: code });
      }
    })();
    return () => {
      active = false;
      clearTimeout(migrationMarker);
      const opened = openedRef.current;
      openedRef.current = null;
      repositoryRef.current = null;
      void opened?.database.closeAsync();
    };
  }, [readyState, startupAttempt]);

  const refreshSetupState = useCallback(
    async (step?: OnboardingStep) => {
      const opened = openedRef.current;
      if (!opened) throw new Error('SESSION_NOT_READY');
      const snapshot = await requireRepository().loadStartupSnapshot();
      setState({
        status: 'setup-required',
        step: step ?? snapshot.onboardingStep,
        schemaVersion: opened.schemaVersion,
        snapshot,
        deviceLocale: readDeviceLocale(),
      });
    },
    [requireRepository],
  );

  const chooseLanguage = useCallback(
    async (language: AppLanguage) => {
      await requireRepository().saveLanguage(language);
      await setAppLanguage(language);
      await refreshSetupState('gym');
    },
    [refreshSetupState, requireRepository],
  );

  const saveGym = useCallback(
    async (input: GymSetupInput) => {
      await requireRepository().saveGymSetup(input);
      await refreshSetupState('security');
    },
    [refreshSetupState, requireRepository],
  );

  const saveSecurity = useCallback(
    async (pin: string, biometricsEnabled: boolean) => {
      const capabilities = getRuntimeCapabilities();
      const verifier = await createPinVerifier(
        pin,
        capabilities.isExpoGo ? 'expo-go-development' : 'native',
      );
      const enabled = biometricsEnabled && (await canUseBiometrics());
      await requireRepository().saveOwnerSecurity(verifier, enabled);
      await refreshSetupState('backup-intro');
    },
    [refreshSetupState, requireRepository],
  );

  const updateGym = useCallback(
    async (input: GymSetupInput) => {
      const current = stateRef.current;
      if (current.status !== 'unlocked') throw new Error('SESSION_NOT_UNLOCKED');
      await requireRepository().updateGymSettings(input);
      const snapshot = await requireRepository().loadStartupSnapshot();
      setState({ ...current, ownerName: input.ownerName.trim(), snapshot });
    },
    [requireRepository],
  );

  const completeOnboarding = useCallback(async () => {
    const repository = requireRepository();
    const opened = openedRef.current;
    if (!opened) throw new Error('SESSION_NOT_READY');
    await repository.completeOnboarding();
    const [snapshot, owner] = await Promise.all([
      repository.loadStartupSnapshot(),
      repository.getOwnerAuth(),
    ]);
    if (!owner) throw new Error('OWNER_NOT_FOUND');
    lastActivityAtRef.current = Date.now();
    setState({
      status: 'unlocked',
      schemaVersion: opened.schemaVersion,
      snapshot,
      ownerId: owner.id,
      ownerName: owner.display_name,
      deviceLocale: readDeviceLocale(),
    });
  }, [requireRepository]);

  const unlockWithPin = useCallback(
    async (pin: string): Promise<UnlockResult> => {
      const repository = requireRepository();
      const result = await new SecurityService(repository).unlockWithPin(pin);
      if (result.status === 'success') {
        const opened = openedRef.current;
        if (!opened) throw new Error('SESSION_NOT_READY');
        const snapshot = await repository.loadStartupSnapshot();
        lastActivityAtRef.current = Date.now();
        setState({
          status: 'unlocked',
          schemaVersion: opened.schemaVersion,
          snapshot,
          ownerId: result.ownerId,
          ownerName: result.ownerName,
          deviceLocale: readDeviceLocale(),
        });
      }
      return result;
    },
    [requireRepository],
  );

  const unlockWithBiometrics = useCallback(async (): Promise<'success' | 'fallback-to-pin'> => {
    const current = stateRef.current;
    if (current.status !== 'locked' || !current.snapshot.settings?.biometricsEnabled) {
      return 'fallback-to-pin';
    }
    const result = await authenticateWithBiometrics(i18n.t('biometricPrompt'), i18n.t('usePin'));
    if (result !== 'success') return result;
    const repository = requireRepository();
    const owner = await repository.getOwnerAuth();
    const opened = openedRef.current;
    if (!owner || !opened) throw new Error('SESSION_NOT_READY');
    await repository.recordSuccessfulUnlock(owner.id, 'biometric');
    lastActivityAtRef.current = Date.now();
    setState({
      status: 'unlocked',
      schemaVersion: opened.schemaVersion,
      snapshot: await repository.loadStartupSnapshot(),
      ownerId: owner.id,
      ownerName: owner.display_name,
      deviceLocale: readDeviceLocale(),
    });
    return 'success';
  }, [requireRepository]);

  const reauthenticateOwner = useCallback(
    async (pin: string): Promise<boolean> => {
      const result = await new SecurityService(requireRepository()).unlockWithPin(pin);
      return result.status === 'success';
    },
    [requireRepository],
  );

  const lock = useCallback(
    async (reason: 'manual' | 'inactivity' | 'background' = 'manual') => {
      const current = stateRef.current;
      if (current.status !== 'unlocked') return;
      await requireRepository().recordLock(current.ownerId, reason);
      setState({
        status: 'locked',
        schemaVersion: current.schemaVersion,
        snapshot: current.snapshot,
        deviceLocale: readDeviceLocale(),
      });
    },
    [requireRepository],
  );

  const changeLanguage = useCallback(
    async (language: AppLanguage) => {
      await requireRepository().updateLanguage(language);
      await setAppLanguage(language);
      const current = stateRef.current;
      if (current.status !== 'locked' && current.status !== 'unlocked') return;
      const snapshot = await requireRepository().loadStartupSnapshot();
      setState({ ...current, snapshot });
    },
    [requireRepository],
  );

  const changeInactivityTimeout = useCallback(
    async (seconds: number) => {
      await requireRepository().updateInactivityTimeout(seconds);
      const current = stateRef.current;
      if (current.status !== 'unlocked') return;
      const snapshot = await requireRepository().loadStartupSnapshot();
      setState({ ...current, snapshot });
    },
    [requireRepository],
  );

  const recordActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
  }, []);

  const getPhase2Repository = useCallback((): Phase2Repository => {
    const opened = openedRef.current;
    if (!opened || stateRef.current.status !== 'unlocked') throw new Error('SESSION_NOT_UNLOCKED');
    return new Phase2Repository(opened.database);
  }, []);

  const getPhase3Repository = useCallback((): Phase3Repository => {
    const opened = openedRef.current;
    if (!opened || stateRef.current.status !== 'unlocked') throw new Error('SESSION_NOT_UNLOCKED');
    return new Phase3Repository(opened.database);
  }, []);

  const getPhase4Repository = useCallback((): Phase4Repository => {
    const opened = openedRef.current;
    if (!opened || stateRef.current.status !== 'unlocked') throw new Error('SESSION_NOT_UNLOCKED');
    return new Phase4Repository(opened.database);
  }, []);

  const getBackupService = useCallback((): BackupService => {
    const opened = openedRef.current;
    const current = stateRef.current;
    if (!opened || current.status !== 'unlocked') throw new Error('SESSION_NOT_UNLOCKED');
    return new BackupService(opened.database, opened.schemaVersion, current.ownerId, opened.key);
  }, []);

  const createBackup = useCallback(
    async (passphrase: string, ownerPin: string): Promise<SavedBackup> => {
      if (!(await reauthenticateOwner(ownerPin)))
        throw new Error('OWNER_REAUTHENTICATION_REQUIRED');
      return getBackupService().create(passphrase);
    },
    [getBackupService, reauthenticateOwner],
  );

  const previewBackup = useCallback(
    (file: File, passphrase: string): Promise<BackupManifest> =>
      getBackupService().preview(file, passphrase),
    [getBackupService],
  );

  const restoreBackup = useCallback(
    async (file: File, passphrase: string, ownerPin: string): Promise<BackupManifest> => {
      if (!(await reauthenticateOwner(ownerPin)))
        throw new Error('OWNER_REAUTHENTICATION_REQUIRED');
      let liveHandleClosed = false;
      try {
        const manifest = await getBackupService().restore(file, passphrase, {
          beforeLiveReplacement: async () => {
            liveHandleClosed = true;
            openedRef.current = null;
            repositoryRef.current = null;
          },
        });
        setState({ status: 'migrating' });
        setStartupAttempt((attempt) => attempt + 1);
        return manifest;
      } catch (error) {
        if (liveHandleClosed) {
          setState({ status: 'migrating' });
          setStartupAttempt((attempt) => attempt + 1);
        }
        throw error;
      }
    },
    [getBackupService, reauthenticateOwner],
  );

  const deleteAllLocalData = useCallback(
    async (ownerPin: string): Promise<boolean> => {
      if (!(await reauthenticateOwner(ownerPin))) return false;
      const opened = openedRef.current;
      openedRef.current = null;
      repositoryRef.current = null;
      await opened?.database.closeAsync();
      try {
        deleteGymVitoDatabaseFiles();
        await deleteDatabaseKey();
        return true;
      } finally {
        setState({ status: 'migrating' });
        setStartupAttempt((attempt) => attempt + 1);
      }
    },
    [reauthenticateOwner],
  );

  const previewRecoveryBackup = useCallback(
    (file: File, passphrase: string): Promise<BackupManifest> => {
      if (!getRuntimeCapabilities().nativeSecurityProofs) {
        throw new Error('NATIVE_SECURITY_BUILD_REQUIRED');
      }
      return verifyEncryptedBackup(file, passphrase);
    },
    [],
  );

  const recoverFromBackup = useCallback(
    async (file: File, passphrase: string): Promise<BackupManifest> => {
      const current = stateRef.current;
      if (current.status === 'unlocked' || current.status === 'locked') {
        throw new Error('RECOVERY_REQUIRES_LOCKED_OUT_OR_NEW_INSTALL');
      }
      if (!getRuntimeCapabilities().nativeSecurityProofs) {
        throw new Error('NATIVE_SECURITY_BUILD_REQUIRED');
      }
      const opened = openedRef.current;
      openedRef.current = null;
      repositoryRef.current = null;
      await opened?.database.closeAsync();
      try {
        const deviceKey = await getOrCreateRecoveryDatabaseKey();
        const manifest = await recoverEncryptedBackup(file, passphrase, deviceKey, {
          afterReplacementVerified: async (replacement, sourceManifest) => {
            const repository = new Phase5Repository(replacement);
            await repository.recordSuccessfulRestore({
              targetDescriptor: file.name,
              formatVersion: sourceManifest.formatVersion,
              schemaVersion: sourceManifest.schemaVersion,
              sourceAppVersion: sourceManifest.sourceAppVersion,
              fileSizeBytes: file.size,
              recordCounts: sourceManifest.recordCounts,
            });
          },
        });
        setState({ status: 'migrating' });
        setStartupAttempt((attempt) => attempt + 1);
        return manifest;
      } catch (error) {
        setState({ status: 'recovery-error', messageCode: diagnosticCode(error) });
        throw error;
      }
    },
    [],
  );

  useEffect(() => {
    return observeDeviceLocale((deviceLocale) => {
      const current = stateRef.current;
      if (
        current.status === 'setup-required' ||
        current.status === 'locked' ||
        current.status === 'unlocked'
      ) {
        setState({ ...current, deviceLocale });
      }
    });
  }, []);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      const current = stateRef.current;
      if (next !== 'active') {
        backgroundedAtRef.current = Date.now();
        return;
      }
      if (current.status === 'unlocked') {
        const threshold = (current.snapshot.settings?.inactivityTimeoutSeconds ?? 300) * 1000;
        const elapsed = Date.now() - (backgroundedAtRef.current ?? lastActivityAtRef.current);
        if (elapsed >= threshold) void lock('background');
      }
      backgroundedAtRef.current = null;
    };
    const subscription = AppState.addEventListener('change', onAppState);
    return () => subscription.remove();
  }, [lock]);

  useEffect(() => {
    if (state.status !== 'unlocked') return;
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (current.status !== 'unlocked' || AppState.currentState !== 'active') return;
      const threshold = (current.snapshot.settings?.inactivityTimeoutSeconds ?? 300) * 1000;
      if (Date.now() - lastActivityAtRef.current >= threshold) void lock('inactivity');
    }, 1000);
    return () => clearInterval(timer);
  }, [lock, state.status]);

  const value = useMemo<AppSessionContextValue>(
    () => ({
      state,
      chooseLanguage,
      saveGym,
      updateGym,
      saveSecurity,
      completeOnboarding,
      unlockWithPin,
      unlockWithBiometrics,
      reauthenticateOwner,
      lock,
      changeLanguage,
      changeInactivityTimeout,
      recordActivity,
      retryStartup: () => {
        setState({ status: 'migrating' });
        setStartupAttempt((attempt) => attempt + 1);
      },
      getPhase2Repository,
      getPhase3Repository,
      getPhase4Repository,
      getBackupService,
      createBackup,
      previewBackup,
      restoreBackup,
      deleteAllLocalData,
      previewRecoveryBackup,
      recoverFromBackup,
    }),
    [
      changeInactivityTimeout,
      changeLanguage,
      chooseLanguage,
      completeOnboarding,
      getPhase2Repository,
      getPhase3Repository,
      getPhase4Repository,
      getBackupService,
      createBackup,
      previewBackup,
      restoreBackup,
      deleteAllLocalData,
      previewRecoveryBackup,
      recoverFromBackup,
      lock,
      reauthenticateOwner,
      recordActivity,
      saveGym,
      saveSecurity,
      state,
      updateGym,
      unlockWithBiometrics,
      unlockWithPin,
    ],
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession(): AppSessionContextValue {
  const value = useContext(AppSessionContext);
  if (!value) throw new Error('AppSessionProvider is missing.');
  return value;
}
