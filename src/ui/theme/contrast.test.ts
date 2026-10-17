import { compositeOver, contrastRatio, flatten, parseColor } from './contrast';
import { actionPressed, colors, glass } from './tokens';

const AA_BODY = 4.5;
const AA_LARGE = 3;

describe('contrast helpers', () => {
  it('parses hex and rgba colours', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1]);
    expect(parseColor('#0d6659')).toEqual([13, 102, 89, 1]);
    expect(parseColor('rgba(13, 102, 89, 0.12)')).toEqual([13, 102, 89, 0.12]);
    expect(parseColor('rgb(1,2,3)')).toEqual([1, 2, 3, 1]);
    expect(() => parseColor('teal')).toThrow('Unsupported colour');
  });

  it('matches the WCAG reference ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('composites translucent layers over an opaque base', () => {
    expect(compositeOver('rgba(0, 0, 0, 0.5)', '#ffffff')).toEqual([127.5, 127.5, 127.5, 1]);
    expect(flatten(['#ffffff', 'rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.5)'])).toEqual([
      63.75, 63.75, 63.75, 1,
    ]);
  });
});

describe('glass legibility (worst case: frost over the most saturated backdrop blob)', () => {
  const blobs = Object.values(glass.backdrop);
  const frosts = { ios: glass.frost, androidWithoutBlur: glass.frostSolid };
  const tints = [undefined, glass.tintSuccess, glass.tintWarning];

  const panelText = {
    text: colors.text,
    textMuted: colors.textMuted,
    primaryDark: colors.primaryDark,
    danger: colors.danger,
    dangerText: colors.dangerText,
    successText: colors.successText,
    warningText: colors.warningText,
  };

  function worstCase(foreground: string, frost: string, tint?: string) {
    return Math.min(
      ...blobs.map((blob) =>
        contrastRatio(
          foreground,
          flatten([colors.background, blob, frost, ...(tint ? [tint] : [])]),
        ),
      ),
    );
  }

  it.each(Object.entries(frosts))('keeps panel body text at AA on %s frost', (_, frost) => {
    const failures = tints.flatMap((tint) =>
      Object.entries(panelText)
        .map(([name, foreground]) => ({ name, tint, ratio: worstCase(foreground, frost, tint) }))
        .filter(({ ratio }) => ratio < AA_BODY),
    );
    expect(failures).toEqual([]);
  });

  it('keeps section titles legible directly on the backdrop', () => {
    for (const blob of blobs) {
      expect(contrastRatio(colors.text, flatten([colors.background, blob]))).toBeGreaterThan(
        AA_LARGE,
      );
    }
  });

  it('keeps white labels legible on solid primary and danger buttons', () => {
    expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(colors.onPrimary, colors.danger)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('keeps panel tints at or above 0.85 alpha', () => {
    expect(parseColor(glass.tintSuccess)[3]).toBeGreaterThanOrEqual(0.85);
    expect(parseColor(glass.tintWarning)[3]).toBeGreaterThanOrEqual(0.85);
  });

  it('keeps the frost dense enough for in-flow panels', () => {
    expect(parseColor(glass.frost)[3]).toBeGreaterThanOrEqual(0.62);
    expect(parseColor(glass.frostSolid)[3]).toBeGreaterThanOrEqual(0.86);
  });
});

describe('actionPressed', () => {
  it('dims and slightly shrinks the pressed element', () => {
    expect(actionPressed).toEqual({ opacity: 0.72, transform: [{ scale: 0.98 }] });
    expect(Object.isFrozen(actionPressed)).toBe(true);
  });
});
