import { translations, resolveLocale, DEFAULT_LOCALE } from "../locales";
import { COLOR_KEYS } from "../utils/colorNames";

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  );

const en = Object.fromEntries(flatten(translations.en));
const placeholders = (str) => (str.match(/\{\{\s*\w+\s*\}\}/g) || []).sort();
const LOCALES = Object.keys(translations);

test("ships the ten planned languages", () => {
  expect(LOCALES.sort()).toEqual(["de", "en", "es", "fr", "ja", "ko", "pt", "tr", "vi", "zh"]);
});

test("English defines every CSS color", () => {
  expect(Object.keys(translations.en.colors).sort()).toEqual([...COLOR_KEYS].sort());
});

describe.each(LOCALES.filter((l) => l !== "en"))("%s", (locale) => {
  const flat = Object.fromEntries(flatten(translations[locale]));

  test("has exactly the same keys as English", () => {
    expect(Object.keys(flat).sort()).toEqual(Object.keys(en).sort());
  });

  test("has no empty strings", () => {
    for (const [key, value] of Object.entries(flat)) {
      expect({ key, ok: typeof value === "string" && value.trim().length > 0 }).toEqual({ key, ok: true });
    }
  });

  test("keeps the same {{placeholders}} as English", () => {
    for (const key of Object.keys(en)) {
      expect({ key, p: placeholders(flat[key]) }).toEqual({ key, p: placeholders(en[key]) });
    }
  });
});

describe.each(LOCALES)("%s color names", (locale) => {
  test("are unique so two different colors never share a label", () => {
    const names = Object.entries(translations[locale].colors);
    const seen = {};
    const dupes = [];
    for (const [key, name] of names) {
      // CSS defines these as exact aliases of each other.
      const canonical = { Aqua: "Cyan", Fuchsia: "Magenta" }[key] || key;
      if (seen[name] && seen[name] !== canonical) dupes.push(`${seen[name]} / ${key}: ${name}`);
      seen[name] = seen[name] || canonical;
    }
    expect(dupes).toEqual([]);
  });
});

describe("resolveLocale", () => {
  test("uses supported language codes and falls back to English", () => {
    expect(resolveLocale("tr")).toBe("tr");
    expect(resolveLocale("vi")).toBe("vi");
    expect(resolveLocale("ru")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("constructor")).toBe(DEFAULT_LOCALE);
  });
});
