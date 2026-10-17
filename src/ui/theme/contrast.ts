export type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

/** Parses `#rgb`, `#rrggbb` or `rgba(r, g, b, a)` / `rgb(r, g, b)`. */
export function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((digit) => digit + digit)
            .join('')
        : hex[1];
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
      1,
    ];
  }
  const functional =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
      value.trim(),
    );
  if (functional) {
    return [
      Number(functional[1]),
      Number(functional[2]),
      Number(functional[3]),
      functional[4] === undefined ? 1 : Number(functional[4]),
    ];
  }
  throw new Error(`Unsupported colour: ${value}`);
}

/** Alpha-composites `top` over an opaque `bottom`, returning an opaque colour. */
export function compositeOver(top: string | Rgba, bottom: string | Rgba): Rgba {
  const [tr, tg, tb, ta] = typeof top === 'string' ? parseColor(top) : top;
  const [br, bg, bb] = typeof bottom === 'string' ? parseColor(bottom) : bottom;
  return [tr * ta + br * (1 - ta), tg * ta + bg * (1 - ta), tb * ta + bb * (1 - ta), 1];
}

function relativeLuminance([red, green, blue]: Rgba): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** WCAG 2.x contrast ratio between two opaque colours, from 1 to 21. */
export function contrastRatio(foreground: string | Rgba, background: string | Rgba): number {
  const first = relativeLuminance(
    typeof foreground === 'string' ? parseColor(foreground) : foreground,
  );
  const second = relativeLuminance(
    typeof background === 'string' ? parseColor(background) : background,
  );
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** Composites the layers bottom-up (the first must be opaque) into one opaque colour. */
export function flatten(layers: readonly (string | Rgba)[]): Rgba {
  const [base, ...rest] = layers;
  return rest.reduce<Rgba>(
    (below, layer) => compositeOver(layer, below),
    typeof base === 'string' ? parseColor(base) : base,
  );
}
