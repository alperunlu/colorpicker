import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import CameraScreen from "./screens/CameraScreen";
import GalleryScreen from "./screens/GalleryScreen";
import HistoryScreen from "./screens/HistoryScreen";
import { rgbToHex, hexToRgb } from "./utils/color";
import { nearestColorName } from "./utils/colorNames";
import { DEFAULT_SAMPLE_SIZE } from "./utils/sample";
import { loadSaved, persistSaved, addToHistory, toggleFavorite, removeItem } from "./utils/history";

const TABS = [
  { id: "camera", label: "Camera" },
  { id: "gallery", label: "Photo" },
  { id: "history", label: "History" },
];

export default function App() {
  const [tab, setTab] = useState("camera");
  const [rgb, setRgb] = useState(null); // color shown in the Camera / Photo tabs
  const [paletteType, setPaletteType] = useState("analogous");
  const [sampleSize, setSampleSize] = useState(DEFAULT_SAMPLE_SIZE);
  const [items, setItems] = useState([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadSaved().then((saved) => {
      // Anything picked before the load finished is already in state; keep it.
      setItems((current) => current.concat(saved.filter((s) => !current.some((c) => c.hex === s.hex))));
      loadedRef.current = true;
    });
  }, []);

  useEffect(() => {
    // Don't overwrite what's on disk with the empty initial state.
    if (loadedRef.current) persistSaved(items);
  }, [items]);

  const hexOf = (c) => rgbToHex(c.r, c.g, c.b);

  const handlePick = (picked) => {
    setRgb(picked);
    setItems((current) =>
      addToHistory(current, {
        hex: hexOf(picked),
        name: nearestColorName(picked.r, picked.g, picked.b),
        savedAt: Date.now(),
        favorite: false,
      })
    );
  };

  const handleToggleFavorite = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    setItems((current) => toggleFavorite(current, hex, nearestColorName(r, g, b)));
  };

  const shared = { paletteType, onChangePaletteType: setPaletteType };
  const currentHex = rgb ? hexOf(rgb) : null;
  const currentIsFavorite = !!items.find((i) => i.hex === currentHex)?.favorite;
  const pickerProps = {
    ...shared,
    sampleSize,
    rgb,
    onPick: handlePick,
    onChangeRgb: setRgb,
    isFavorite: currentIsFavorite,
    onToggleFavorite: () => handleToggleFavorite(currentHex),
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {tab === "camera" && (
          <CameraScreen {...pickerProps} onChangeSampleSize={setSampleSize} />
        )}
        {tab === "gallery" && <GalleryScreen {...pickerProps} />}
        {tab === "history" && (
          <HistoryScreen
            {...shared}
            items={items}
            onToggleFavorite={handleToggleFavorite}
            onDelete={(hex) => setItems((current) => removeItem(current, hex))}
            onClearNonFavorites={() => setItems((current) => current.filter((i) => i.favorite))}
          />
        )}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.tab}
            onPress={() => setTab(t.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
            accessibilityLabel={t.label}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "#000",
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabText: { color: "rgba(255, 255, 255, 0.5)", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
});
