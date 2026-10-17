import { compositeOver, contrastRatio, flatten, parseColor } from './contrast';
import { actionPressed, colors, glass, planColors } from './tokens';

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

  it.each(Object.entries(frosts))(
    'keeps the selected navigation tab label at AA on %s frost',
    (_, frost) => {
      expect(worstCase(colors.primaryDark, frost, glass.fillAccent)).toBeGreaterThanOrEqual(
        AA_BODY,
      );
    },
  );

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

describe('shared control legibility (worst case over every blob, on a panel or the bare backdrop)', () => {
  const blobs = Object.values(glass.backdrop);
  const grounds = [[], [glass.frost], [glass.frostSolid]] as const;

  function worstCase(foreground: string, fill: string) {
    return Math.min(
      ...grounds.flatMap((ground) =>
        blobs.map((blob) =>
          contrastRatio(foreground, flatten([colors.background, blob, ...ground, fill])),
        ),
      ),
    );
  }

  it.each([
    ['neutral chip', colors.text, glass.fillNeutral],
    ['active chip', colors.successText, glass.fillSuccess],
    ['warning chip', colors.warningText, glass.fillWarning],
    ['danger chip', colors.dangerText, glass.fillDanger],
    ['warning notice', colors.warningText, glass.tintWarning],
    ['danger notice', colors.danger, glass.tintDanger],
    ['secondary button', colors.primaryDark, glass.fillAccent],
    ['danger-tonal button', colors.dangerText, glass.fillDanger],
    ['unselected choice', colors.text, glass.fillAccent],
    ['field value', colors.text, glass.fillOpaque],
    ['field placeholder', colors.textMuted, glass.fillOpaque],
  ])('keeps %s text at AA', (_, foreground, fill) => {
    expect(worstCase(foreground, fill)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('keeps chip and notice fills at the alpha floors', () => {
    for (const fill of [
      glass.fillNeutral,
      glass.fillSuccess,
      glass.fillWarning,
      glass.fillDanger,
    ]) {
      expect(parseColor(fill)[3]).toBeGreaterThanOrEqual(0.8);
    }
    expect(parseColor(glass.tintDanger)[3]).toBeGreaterThanOrEqual(0.85);
  });
});

describe('wells and tabs inside glass panels (worst case over every blob)', () => {
  const blobs = Object.values(glass.backdrop);

  function worstCase(foreground: string, fill: string, grounds: readonly (readonly string[])[]) {
    return Math.min(
      ...grounds.flatMap((ground) =>
        blobs.map((blob) =>
          contrastRatio(foreground, flatten([colors.background, blob, ...ground, fill])),
        ),
      ),
    );
  }

  const panels = [[glass.frost], [glass.frostSolid]] as const;

  it.each([
    ['muted text in an accent well', colors.textMuted, glass.fillAccent],
    ['primary action text in an accent well', colors.primary, glass.fillAccent],
    ['warning text in an accent well', colors.warningText, glass.fillAccent],
    ['danger text in an accent well', colors.danger, glass.fillAccent],
    ['muted text in a neutral tile', colors.textMuted, glass.fillNeutral],
    ['muted text in an opaque well', colors.textMuted, glass.fillOpaque],
    ['danger amount in a danger well', colors.danger, glass.fillDanger],
    ['success text in a success well', colors.successText, glass.fillSuccess],
    ['text on a selected row', colors.text, glass.tintSelected],
    ['muted text on a selected row', colors.textMuted, glass.tintSelected],
  ])('keeps %s at AA', (_, foreground, fill) => {
    expect(worstCase(foreground, fill, panels)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('keeps unselected tab labels at AA when the tab bar sits on the bare backdrop', () => {
    expect(worstCase(colors.text, glass.fillNeutral, [[], ...panels])).toBeGreaterThanOrEqual(
      AA_BODY,
    );
  });

  it('keeps secondary text on a selected solid primary control at AA', () => {
    expect(contrastRatio(colors.onPrimaryMuted, colors.primary)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('keeps the selected-row tint at or above 0.85 alpha', () => {
    expect(parseColor(glass.tintSelected)[3]).toBeGreaterThanOrEqual(0.85);
  });
});

describe('plan colour swatches', () => {
  it('keeps every swatch a value the plan validator accepts', () => {
    for (const color of planColors) expect(color).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('keeps the selected check mark legible on every swatch', () => {
    for (const color of planColors) {
      expect(contrastRatio(colors.onPrimary, color)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });
});

describe('actionPressed', () => {
  it('dims and slightly shrinks the pressed element', () => {
    expect(actionPressed).toEqual({ opacity: 0.72, transform: [{ scale: 0.98 }] });
    expect(Object.isFrozen(actionPressed)).toBe(true);
  });
});
