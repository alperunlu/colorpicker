import React, { useState } from "react";
import { View, Text, TouchableOpacity, Pressable, Image, StyleSheet, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import ColorCard from "../components/ColorCard";
import { sampleColor, viewToImageCoords } from "../utils/sample";
import { t } from "../utils/i18n";

export default function GalleryScreen({
  sampleSize,
  rgb,
  onPick,
  onChangeRgb,
  paletteType,
  onChangePaletteType,
  isFavorite,
  onToggleFavorite,
}) {
  const [image, setImage] = useState(null); // { uri, width, height }
  const [box, setBox] = useState(null);
  const [marker, setMarker] = useState(null);
  const [busy, setBusy] = useState(false);

  const choosePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      setBusy(true);
      // Re-encoding with no actions bakes in the EXIF rotation, so the width,
      // height and pixels we sample from are exactly what is shown on screen.
      const normalized = await ImageManipulator.manipulateAsync(result.assets[0].uri, [], {
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 1,
      });
      setImage({ uri: normalized.uri, width: normalized.width, height: normalized.height });
      setMarker(null);
    } catch (error) {
      console.error("Error choosing photo:", error);
      Alert.alert(t("common.error"), t("gallery.openFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handlePress = async (event) => {
    if (!image || !box || busy) return;
    const { locationX, locationY } = event.nativeEvent;
    const point = viewToImageCoords(locationX, locationY, box, image);
    if (!point) return;
    setMarker({ x: locationX, y: locationY });
    setBusy(true);
    try {
      const picked = await sampleColor(image.uri, image, point.x, point.y, sampleSize);
      onPick(picked);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error sampling color:", error);
      Alert.alert(t("common.error"), t("gallery.readFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      {image ? (
        <Pressable
          style={styles.flex}
          onPress={handlePress}
          onLayout={(e) => setBox(e.nativeEvent.layout)}
          accessibilityLabel={t("gallery.photoA11y")}
        >
          <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" pointerEvents="none" />
          {marker && (
            <View
              pointerEvents="none"
              style={[styles.marker, { left: marker.x - 14, top: marker.y - 14 }]}
            />
          )}
        </Pressable>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t("gallery.emptyTitle")}</Text>
          <Text style={styles.emptyText}>{t("gallery.emptyText")}</Text>
        </View>
      )}

      {rgb && (
        <View style={styles.cardWrap}>
          <ColorCard
            rgb={rgb}
            paletteType={paletteType}
            onChangePaletteType={onChangePaletteType}
            onChangeRgb={onChangeRgb}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
          />
        </View>
      )}

      <View style={styles.buttonWrap}>
        <TouchableOpacity
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={choosePhoto}
          disabled={busy}
          accessibilityLabel={t("gallery.choosePhotoA11y")}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{image ? t("gallery.changePhoto") : t("gallery.choosePhoto")}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  emptyText: { color: "rgba(255, 255, 255, 0.65)", fontSize: 14, textAlign: "center" },
  marker: {
    position: "absolute", width: 28, height: 28, borderRadius: 14,
    borderWidth: 3, borderColor: "#fff", backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  cardWrap: { position: "absolute", bottom: 100, left: 20, right: 20 },
  buttonWrap: { position: "absolute", bottom: 24, left: 0, right: 0, alignItems: "center" },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.15)", paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: 30, minWidth: 180, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.4)",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
