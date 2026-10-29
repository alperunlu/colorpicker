import UPNG from "upng-js";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP = (() => {
  const t = new Uint8Array(256).fill(255);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

// Hermes has atob() in recent versions, but a hand-rolled decoder keeps this
// module runnable in Node tests and independent of the JS engine.
export const base64ToBytes = (b64) => {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)];
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? B64_LOOKUP[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < clean.length ? B64_LOOKUP[clean.charCodeAt(i + 3)] : 0;
    out[o++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
};

// Average of every pixel in a base64-encoded PNG. Fully-transparent pixels are
// skipped so padding never darkens the result.
export const averageRgbFromPngBase64 = (base64) => {
  const bytes = base64ToBytes(base64);
  const png = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);

  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    r += rgba[i];
    g += rgba[i + 1];
    b += rgba[i + 2];
    count++;
  }
  if (count === 0) throw new Error("Image has no visible pixels");
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
};
