// Pure data module (no Expo imports) so tests can load every locale in Node.
import en from "./en";
import es from "./es";
import pt from "./pt";
import fr from "./fr";
import de from "./de";
import ja from "./ja";
import zh from "./zh";
import ko from "./ko";
import vi from "./vi";
import tr from "./tr";

export const DEFAULT_LOCALE = "en";

// Keyed by ISO 639-1 language code. "pt" is Brazilian Portuguese and "zh" is
// Simplified Chinese; other regional variants fall back to these.
export const translations = { en, es, pt, fr, de, ja, zh, ko, vi, tr };

export const resolveLocale = (languageCode) =>
  languageCode && Object.prototype.hasOwnProperty.call(translations, languageCode)
    ? languageCode
    : DEFAULT_LOCALE;
