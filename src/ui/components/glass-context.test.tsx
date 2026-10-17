import { render } from '@testing-library/react-native';
import { BlurTargetView } from 'expo-blur';
import type { RefObject } from 'react';
import { Text, type View } from 'react-native';

import { GlassBlurTarget, GlassProvider, useGlassBlurTarget } from './glass-context';

const mockGlassUi = { enabled: true };

jest.mock('@/ui/theme/tokens', () => {
  const actual = jest.requireActual('@/ui/theme/tokens');
  return Object.defineProperty({ ...actual }, 'GLASS_UI', {
    get: () => mockGlassUi.enabled,
  });
});

function CaptureTarget({ onTarget }: { onTarget(ref: RefObject<View | null> | undefined): void }) {
  onTarget(useGlassBlurTarget());
  return null;
}

describe('GlassContext', () => {
  afterEach(() => {
    mockGlassUi.enabled = true;
  });

  it('shares one blur target between the content and the floating chrome', () => {
    const targets: (RefObject<View | null> | undefined)[] = [];
    const screen = render(
      <GlassProvider>
        <GlassBlurTarget>
          <Text>Content</Text>
          <CaptureTarget onTarget={(ref) => targets.push(ref)} />
        </GlassBlurTarget>
        <CaptureTarget onTarget={(ref) => targets.push(ref)} />
      </GlassProvider>,
    );

    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(BlurTargetView)).toHaveLength(1);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toBeDefined();
    expect(targets[0]).toBe(targets[1]);
  });

  it('has no blur target outside a provider', () => {
    let target: RefObject<View | null> | undefined = { current: null };
    const screen = render(
      <GlassBlurTarget>
        <Text>Content</Text>
        <CaptureTarget onTarget={(ref) => (target = ref)} />
      </GlassBlurTarget>,
    );

    expect(target).toBeUndefined();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(BlurTargetView)).toHaveLength(0);
  });

  it('renders a plain container when GLASS_UI is off', () => {
    mockGlassUi.enabled = false;
    const screen = render(
      <GlassProvider>
        <GlassBlurTarget>
          <Text>Content</Text>
        </GlassBlurTarget>
      </GlassProvider>,
    );

    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(BlurTargetView)).toHaveLength(0);
  });
});
