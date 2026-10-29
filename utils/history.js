import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "colorpicker:v2:saved";
export const MAX_ITEMS = 200;

// Item shape: { hex, name, savedAt, favorite }. Newest first, one entry per hex.
export const loadSaved = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const persistSaved = async (items) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Error saving history:", error);
  }
};

// Pure list helpers so the screen logic is easy to test.
export const addToHistory = (items, entry) => {
  const existing = items.find((i) => i.hex === entry.hex);
  const rest = items.filter((i) => i.hex !== entry.hex);
  const merged = { ...entry, favorite: existing?.favorite ?? entry.favorite ?? false };
  const next = [merged, ...rest];
  // Never evict favorites; drop the oldest non-favorites first.
  while (next.length > MAX_ITEMS) {
    let idx = -1;
    for (let i = next.length - 1; i >= 0; i--) {
      if (!next[i].favorite) { idx = i; break; }
    }
    if (idx === -1) break;
    next.splice(idx, 1);
  }
  return next;
};

export const toggleFavorite = (items, hex, name) => {
  if (items.some((i) => i.hex === hex)) {
    return items.map((i) => (i.hex === hex ? { ...i, favorite: !i.favorite } : i));
  }
  return [{ hex, name, savedAt: Date.now(), favorite: true }, ...items];
};

export const removeItem = (items, hex) => items.filter((i) => i.hex !== hex);
