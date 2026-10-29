jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import zlib from "zlib";
import {
  rgbToHex, hexToRgb, rgbToHsl, hslToRgb, rgbToHsv, rgbToCmyk,
  contrastRatio, contrastInfo, generatePalette, buildColor,
} from "../utils/color";
import { nearestColorKey } from "../utils/colorNames";
import { base64ToBytes, averageRgbFromPngBase64 } from "../utils/pixels";
import { addToHistory, toggleFavorite, removeItem, MAX_ITEMS } from "../utils/history";

describe("color conversions", () => {
  test("hex round trip", () => {
    expect(rgbToHex(255, 0, 128)).toBe("#FF0080");
    expect(hexToRgb("#FF0080")).toEqual({ r: 255, g: 0, b: 128 });
  });
  test("hsl / hsv / cmyk of known colors", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 100, v: 100 });
    expect(rgbToCmyk(0, 0, 0)).toEqual({ c: "0", m: "0", y: "0", k: "100" });
    expect(rgbToCmyk(255, 0, 0)).toEqual({ c: "0", m: "100", y: "100", k: "0" });
  });
  test("hsl -> rgb round trip", () => {
    const { h, s, l } = rgbToHsl(58, 123, 213);
    const { r, g, b } = hslToRgb(h, s, l);
    expect([r, g, b]).toEqual([58, 123, 213]);
  });
});

describe("contrast", () => {
  test("black on white is 21:1", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
  });
  test("levels", () => {
    expect(contrastInfo(0, 0, 0).white.level).toBe("AAA");
    expect(contrastInfo(128, 128, 128).white.level).toBe("Fail");
  });
});

describe("palettes", () => {
  test.each(["analogous", "complementary", "triadic", "tetradic", "monochromatic"])(
    "%s has 5 colors with the source in the middle",
    (type) => {
      const p = generatePalette(58, 123, 213, type);
      expect(p).toHaveLength(5);
      expect(p[2]).toBe("#3A7BD5");
    }
  );
  test("complementary opposite is 180deg away", () => {
    expect(generatePalette(255, 0, 0, "complementary")[3]).toBe("#00FFFF");
  });
  test("buildColor shape", () => {
    const c = buildColor(255, 0, 0);
    expect(c.hex).toBe("#FF0000");
    expect(c.palette).toHaveLength(5);
  });
});

describe("color names", () => {
  test("exact and near matches", () => {
    expect(nearestColorKey(255, 0, 0)).toBe("Red");
    expect(nearestColorKey(250, 5, 5)).toBe("Red");
    expect(nearestColorKey(70, 130, 180)).toBe("SteelBlue");
  });
});

describe("pixels", () => {
  // Builds a standard 8-bit PNG (color type 6 = RGBA, 2 = RGB), the format the
  // native image encoders hand us in the app.
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const png = (pixels, w, h, channels = 4) => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
    const rows = [];
    for (let y = 0; y < h; y++) {
      rows.push(Buffer.from([0]), Buffer.from(pixels.slice(y * w * channels, (y + 1) * w * channels)));
    }
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
      chunk("IEND", Buffer.alloc(0)),
    ]).toString("base64");
  };

  test("base64ToBytes matches Buffer for all padding lengths", () => {
    for (const s of ["a", "ab", "abc", "abcd", "hello world"]) {
      const b64 = Buffer.from(s).toString("base64");
      expect(Buffer.from(base64ToBytes(b64)).toString()).toBe(s);
    }
  });
  test("averages a solid 9x9 PNG", () => {
    const px = [];
    for (let i = 0; i < 81; i++) px.push(58, 123, 213, 255);
    expect(averageRgbFromPngBase64(png(px, 9, 9))).toEqual({ r: 58, g: 123, b: 213 });
  });
  test("decodes opaque RGB (no alpha channel) PNGs", () => {
    const px = [10, 20, 30, 30, 40, 50];
    expect(averageRgbFromPngBase64(png(px, 2, 1, 3))).toEqual({ r: 20, g: 30, b: 40 });
  });
  test("averages mixed pixels and skips transparent ones", () => {
    const px = [0, 0, 0, 255, 100, 200, 50, 255, 9, 9, 9, 0, 9, 9, 9, 0];
    expect(averageRgbFromPngBase64(png(px, 2, 2))).toEqual({ r: 50, g: 100, b: 25 });
  });
});

describe("history", () => {
  const e = (hex, extra = {}) => ({ hex, savedAt: 1, favorite: false, ...extra });
  test("dedupes by hex, newest first, keeps favorite flag", () => {
    let items = addToHistory([], e("#111111"));
    items = toggleFavorite(items, "#111111");
    items = addToHistory(items, e("#222222"));
    items = addToHistory(items, e("#111111"));
    expect(items.map((i) => i.hex)).toEqual(["#111111", "#222222"]);
    expect(items[0].favorite).toBe(true);
  });
  test("toggleFavorite adds unknown colors as favorites", () => {
    expect(toggleFavorite([], "#ABCDEF")[0]).toMatchObject({ hex: "#ABCDEF", favorite: true });
  });
  test("removeItem", () => {
    expect(removeItem([e("#111111"), e("#222222")], "#111111").map((i) => i.hex)).toEqual(["#222222"]);
  });
  test("trims oldest non-favorites and never evicts favorites", () => {
    let items = [e("#000000", { favorite: true })];
    for (let i = 1; i <= MAX_ITEMS + 5; i++) {
      items = addToHistory(items, e("#" + i.toString(16).padStart(6, "0").toUpperCase()));
    }
    expect(items).toHaveLength(MAX_ITEMS);
    expect(items.some((i) => i.hex === "#000000")).toBe(true);
  });
});

describe("viewToImageCoords", () => {
  const { viewToImageCoords } = jest.requireActual("../utils/sample");
  // 200x100 image in a 100x100 box -> scale 0.5, 25px letterbox top/bottom.
  const box = { width: 100, height: 100 };
  const image = { width: 200, height: 100 };
  test("maps the center", () => {
    expect(viewToImageCoords(50, 50, box, image)).toEqual({ x: 100, y: 50 });
  });
  test("rejects letterbox touches", () => {
    expect(viewToImageCoords(50, 10, box, image)).toBeNull();
    expect(viewToImageCoords(50, 90, box, image)).toBeNull();
  });
  test("maps image corners", () => {
    expect(viewToImageCoords(0, 25, box, image)).toEqual({ x: 0, y: 0 });
  });
});
