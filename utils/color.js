// Pure color math. No React / Expo imports so it can be unit tested in Node.

export const rgbToHex = (r, g, b) =>
  ("#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)).toUpperCase();

export const hexToRgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

export const rgbToCmyk = (r, g, b) => {
  let c = 1 - r / 255;
  let m = 1 - g / 255;
  let y = 1 - b / 255;
  const k = Math.min(c, m, y);
  if (k === 1) {
    return { c: "0", m: "0", y: "0", k: "100" };
  }
  c = (((c - k) / (1 - k)) * 100).toFixed(0);
  m = (((m - k) / (1 - k)) * 100).toFixed(0);
  y = (((y - k) / (1 - k)) * 100).toFixed(0);
  return { c, m, y, k: (k * 100).toFixed(0) };
};

export const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
};

export const hslToRgb = (h, s, l) => {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

export const rgbToHsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
};

// WCAG 2.x relative luminance and contrast ratio.
const channelToLinear = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

export const relativeLuminance = (r, g, b) =>
  0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);

export const contrastRatio = (a, b) => {
  const la = relativeLuminance(a.r, a.g, a.b);
  const lb = relativeLuminance(b.r, b.g, b.b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// Normal-size text thresholds: AAA >= 7, AA >= 4.5, otherwise fail.
export const wcagLevel = (ratio) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : "Fail");

export const contrastInfo = (r, g, b) => {
  const white = contrastRatio({ r, g, b }, { r: 255, g: 255, b: 255 });
  const black = contrastRatio({ r, g, b }, { r: 0, g: 0, b: 0 });
  return {
    white: { ratio: white, level: wcagLevel(white) },
    black: { ratio: black, level: wcagLevel(black) },
  };
};

// ---- Palettes -------------------------------------------------------------

const rotate = (hsl, deg) => hslToRgb((hsl.h + deg + 360) % 360, hsl.s, hsl.l);
const toHex = ({ r, g, b }) => rgbToHex(r, g, b);

export const PALETTE_TYPES = [
  { id: "analogous", label: "Analogous" },
  { id: "complementary", label: "Complementary" },
  { id: "triadic", label: "Triadic" },
  { id: "tetradic", label: "Tetradic" },
  { id: "monochromatic", label: "Mono" },
];

// Each palette is 5 hex strings with the picked color in the middle slot, so
// the UI can always highlight the source color in the same position.
export const generatePalette = (r, g, b, type = "analogous") => {
  const hsl = rgbToHsl(r, g, b);
  const self = rgbToHex(r, g, b);
  const shade = (delta) => toHex(hslToRgb(hsl.h, hsl.s, Math.min(100, Math.max(0, hsl.l + delta))));

  switch (type) {
    case "complementary":
      return [shade(20), toHex(rotate(hsl, 150)), self, toHex(rotate(hsl, 180)), shade(-20)];
    case "triadic":
      return [shade(20), toHex(rotate(hsl, 120)), self, toHex(rotate(hsl, 240)), shade(-20)];
    case "tetradic":
      return [toHex(rotate(hsl, 90)), toHex(rotate(hsl, 180)), self, toHex(rotate(hsl, 270)), shade(-20)];
    case "monochromatic":
      return [shade(30), shade(15), self, shade(-15), shade(-30)];
    case "analogous":
    default:
      return [shade(20), toHex(rotate(hsl, 45)), self, toHex(rotate(hsl, -45)), shade(-20)];
  }
};

export const buildColor = (r, g, b, paletteType = "analogous") => {
  const hsl = rgbToHsl(r, g, b);
  const hsv = rgbToHsv(r, g, b);
  return {
    r, g, b,
    hex: rgbToHex(r, g, b),
    cmyk: rgbToCmyk(r, g, b),
    hsl: { h: hsl.h.toFixed(0), s: hsl.s.toFixed(0), l: hsl.l.toFixed(0) },
    hsv: { h: hsv.h.toFixed(0), s: hsv.s.toFixed(0), v: hsv.v.toFixed(0) },
    palette: generatePalette(r, g, b, paletteType),
  };
};
