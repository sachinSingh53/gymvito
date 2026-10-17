import { render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { Text } from 'react-native';

import { colors, radii } from '@/ui/theme/tokens';

import { GlassBackdrop, GlassSheen, GlassSurface } from './glass-surface';

const mockGlassUi = { enabled: true };

jest.mock('@/ui/theme/tokens', () => {
  const actual = jest.requireActual('@/ui/theme/tokens');
  return Object.defineProperty({ ...actual }, 'GLASS_UI', {
    get: () => mockGlassUi.enabled,
  });
});

describe('GlassSurface', () => {
  afterEach(() => {
    mockGlassUi.enabled = true;
  });

  it('renders frosted glass when GLASS_UI is on', () => {
    const screen = render(
      <GlassSurface>
        <Text>Panel</Text>
      </GlassSurface>,
    );

    expect(screen.getByText('Panel')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(1);
    expect(render(<GlassBackdrop />).toJSON()).not.toBeNull();
    expect(render(<GlassSheen />).toJSON()).not.toBeNull();
  });

  it('renders the flat card, with no blur, backdrop or sheen, when GLASS_UI is off', () => {
    mockGlassUi.enabled = false;
    const screen = render(
      <GlassSurface>
        <Text>Panel</Text>
      </GlassSurface>,
    );

    expect(screen.getByText('Panel')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(0);
    expect(screen.toJSON()).toHaveStyle({
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.md,
    });
    expect(render(<GlassBackdrop />).toJSON()).toBeNull();
    expect(render(<GlassSheen />).toJSON()).toBeNull();
  });

  it('keeps a warning tint on the flat card', () => {
    mockGlassUi.enabled = false;
    const screen = render(
      <GlassSurface tint="rgba(250, 242, 220, 0.92)">
        <Text>Backup needed</Text>
      </GlassSurface>,
    );

    expect(screen.toJSON()).toHaveStyle({ backgroundColor: 'rgba(250, 242, 220, 0.92)' });
  });
});
