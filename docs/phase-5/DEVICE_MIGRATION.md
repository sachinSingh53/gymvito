# Move GymVito to a New Device

1. On the old device, open **More → Backup and recovery → Create backup**.
2. Enter the owner PIN and create a unique backup passphrase of at least 12 characters containing a letter and a number.
3. Save the `.gymvito` file to a user-controlled document provider, USB/SD storage, or another destination available through Android's system picker.
4. Wait for GymVito to report that the destination file was verified. Do not uninstall or reset the old device before this confirmation.
5. Transfer the `.gymvito` file to a location the new device's system picker can access. GymVito does not upload or synchronize it.
6. Install a GymVito development/release build on the new device. Expo Go cannot perform encrypted restore.
7. On the language screen, choose **Restore an existing gym backup**. Select the file, enter its backup passphrase, and review the gym name, date, versions, and counts.
8. Confirm recovery. GymVito creates a new device database key, re-encrypts the restored data for the new device, migrates supported older schemas, and reconciles it before activation.
9. Unlock with the owner PIN that belonged to the restored gym. Create and verify a fresh backup from the new device.
10. Keep the old device and original backup until members, memberships, invoices, payments, settings, sequences, media, and history have been checked on the new device.

If the passphrase is forgotten, the file is damaged, or it was created by a newer unsupported GymVito version, the backup cannot replace current data. GymVito has no server-held recovery copy.
