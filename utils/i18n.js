import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";
import { translations, resolveLocale, DEFAULT_LOCALE } from "../locales";
import { nearestColorKey } from "./colorNames";

const deviceLocale = getLocales()[0];

const i18n = new I18n(translations);
i18n.defaultLocale = DEFAULT_LOCALE;
i18n.enableFallback = true;
i18n.locale = resolveLocale(deviceLocale?.languageCode);

export const t = (key, options) => i18n.t(key, options);

export const colorName = (key) => i18n.t(`colors.${key}`);

export const nearestColorLabel = (r, g, b) => colorName(nearestColorKey(r, g, b));

// "4.5" -> "4,5" in locales that use a decimal comma.
export const formatDecimal = (value, digits = 1) =>
  value.toFixed(digits).replace(".", deviceLocale?.decimalSeparator || ".");

export default i18n;
