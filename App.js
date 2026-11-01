import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import CameraScreen from "./screens/CameraScreen";
import GalleryScreen from "./screens/GalleryScreen";
import HistoryScreen from "./screens/HistoryScreen";
import { rgbToHex } from "./utils/color";
import { t } from "./utils/i18n";
import { loadSaved, persistSaved, addToHistory, toggleFavorite, removeItem } from "./utils/history";

export default function App() {
  const [screen, setScreen] = useState("camera"); // "camera" | "gallery" | "history"
  const [returnTo, setReturnTo] = useState("camera"); // where History's back button goes
  const [rgb, setRgb] = useState(null); // color shown on the Camera / Photo screens
  const [photo, setPhoto] = useState(null); // chosen library photo, kept across tab switches
  const [busy, setBusy] = useState(false);
  const [paletteType, setPaletteType] = useState("analogous");
  const [items, setItems] = useState([]);
  const loadedRef = useRef(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

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
        savedAt: Date.now(),
        favorite: false,
      })
    );
  };

  const handleToggleFavorite = (hex) => {
    setItems((current) => toggleFavorite(current, hex));
  };

  const openHistory = () => {
    setReturnTo(screen);
    setScreen("history");
  };

  const switchTo = (next) => {
    if (busy || next === screen) return;
    setScreen(next);
  };

  // The center button is the current screen's main action.
  const primary = screen === "camera"
    ? { label: t("camera.pickColor"), a11y: t("camera.pickColorA11y"), run: () => cameraRef.current?.pick() }
    : {
        label: photo ? t("gallery.changePhoto") : t("gallery.choosePhoto"),
        a11y: t("gallery.choosePhotoA11y"),
        run: () => galleryRef.current?.choosePhoto(),
      };

  const currentHex = rgb ? hexOf(rgb) : null;
  const pickerProps = {
    rgb,
    onPick: handlePick,
    onBusyChange: setBusy,
    onOpenHistory: openHistory,
    onChangeRgb: setRgb,
    paletteType,
    onChangePaletteType: setPaletteType,
    isFavorite: !!items.find((i) => i.hex === currentHex)?.favorite,
    onToggleFavorite: () => handleToggleFavorite(currentHex),
    onClose: () => setRgb(null),
  };

  const tab = (id, labelKey) => (
    <TouchableOpacity
      style={styles.tab}
      onPress={() => switchTo(id)}
      accessibilityRole="tab"
      accessibilityState={{ selected: screen === id }}
      accessibilityLabel={t(labelKey)}
    >
      <Text style={[styles.tabText, screen === id && styles.tabTextActive]} numberOfLines={1}>{t(labelKey)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {screen === "camera" && <CameraScreen ref={cameraRef} {...pickerProps} />}
        {screen === "gallery" && (
          <GalleryScreen ref={galleryRef} {...pickerProps} image={photo} onImageChange={setPhoto} />
        )}
        {screen === "history" && (
          <HistoryScreen
            items={items}
            paletteType={paletteType}
            onChangePaletteType={setPaletteType}
            onBack={() => setScreen(returnTo)}
            onToggleFavorite={handleToggleFavorite}
            onDelete={(hex) => setItems((current) => removeItem(current, hex))}
            onClearNonFavorites={() => setItems((current) => current.filter((i) => i.favorite))}
          />
        )}
      </View>

      {screen !== "history" && (
        <View style={styles.bottomBar}>
          {tab("camera", "tabs.camera")}
          <TouchableOpacity
            style={[styles.primary, busy && styles.primaryBusy]}
            onPress={primary.run}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={primary.a11y}
            accessibilityState={{ disabled: busy }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText} numberOfLines={1} adjustsFontSizeToFit>{primary.label}</Text>
            )}
          </TouchableOpacity>
          {tab("gallery", "tabs.photo")}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  content: { flex: 1 },
  bottomBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.15)", backgroundColor: "#000",
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabText: { color: "rgba(255, 255, 255, 0.5)", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  primary: {
    flex: 1.6, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", paddingHorizontal: 14,
    backgroundColor: "rgba(255, 255, 255, 0.15)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.4)",
  },
  primaryBusy: { opacity: 0.6 },
  primaryText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
