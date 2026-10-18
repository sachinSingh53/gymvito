import { render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { StyleSheet, Text, View } from 'react-native';

import { glass } from '@/ui/theme/tokens';

import { GlassBackdrop, GlassSurface } from './glass-surface';

describe('GlassSurface', () => {
  it('renders frosted glass', () => {
    const screen = render(
      <GlassSurface>
        <Text>Panel</Text>
      </GlassSurface>,
    );

    expect(screen.getByText('Panel')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(BlurView)).toHaveLength(1);
    expect(render(<GlassBackdrop />).toJSON()).not.toBeNull();
  });

  it('paints a caller tint over the frost layer', () => {
    const screen = render(
      <GlassSurface tint={glass.tintWarning}>
        <Text>Backup needed</Text>
      </GlassSurface>,
    );

    expect(
      screen
        .UNSAFE_getAllByType(View)
        .map((view) => StyleSheet.flatten(view.props.style)?.backgroundColor),
    ).toContain(glass.tintWarning);
  });
});
