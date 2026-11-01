import React, { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { View, Text, TouchableOpacity, Pressable, Image, StyleSheet, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import ColorCard from "../components/ColorCard";
import { sampleColor, viewToImageCoords } from "../utils/sample";
import { t } from "../utils/i18n";

// The "Choose / Change Photo" button lives in the app's bottom bar and calls
// `choosePhoto()` through a ref. The chosen image is owned by the parent so it
// survives switching tabs.
const GalleryScreen = forwardRef(function GalleryScreen({
  image,
  onImageChange,
  rgb,
  onPick,
  onBusyChange,
  onOpenHistory,
  onChangeRgb,
  paletteType,
  onChangePaletteType,
  isFavorite,
  onToggleFavorite,
  onClose,
}, ref) {
  const [box, setBox] = useState(null);
  const [marker, setMarker] = useState(null);
  const busyRef = useRef(false);

  const setBusy = (busy) => {
    busyRef.current = busy;
    onBusyChange?.(busy);
  };

  const choosePhoto = async () => {
    if (busyRef.current) return;
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
      onImageChange({ uri: normalized.uri, width: normalized.width, height: normalized.height });
      setMarker(null);
    } catch (error) {
      console.error("Error choosing photo:", error);
      Alert.alert(t("common.error"), t("gallery.openFailed"));
    } finally {
      setBusy(false);
    }
  };

  useImperativeHandle(ref, () => ({ choosePhoto }));

  const handlePress = async (event) => {
    if (!image || !box || busyRef.current) return;
    const { locationX, locationY } = event.nativeEvent;
    const point = viewToImageCoords(locationX, locationY, box, image);
    if (!point) return;
    setMarker({ x: locationX, y: locationY });
    setBusy(true);
    try {
      const picked = await sampleColor(image.uri, image, point.x, point.y);
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

      <View style={styles.topButtons} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onOpenHistory}
          accessibilityLabel={t("tabs.history")}
          accessibilityRole="button"
        >
          <Text style={styles.iconButtonText} numberOfLines={1}>{t("tabs.history")}</Text>
        </TouchableOpacity>
      </View>

      {rgb && (
        <View style={styles.cardWrap}>
          <ColorCard
            rgb={rgb}
            paletteType={paletteType}
            onChangePaletteType={onChangePaletteType}
            onChangeRgb={onChangeRgb}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            onClose={onClose}
          />
        </View>
      )}
    </View>
  );
});

export default GalleryScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  emptyText: { color: "rgba(255, 255, 255, 0.65)", fontSize: 14, textAlign: "center" },
  marker: {
    position: "absolute", width: 28, height: 28, borderRadius: 14,
    borderWidth: 3, borderColor: "#fff", backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  topButtons: { position: "absolute", top: 16, left: 20, right: 20, alignItems: "center" },
  iconButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)", paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.25)",
  },
  iconButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  cardWrap: { position: "absolute", bottom: 12, left: 12, right: 12 },
});
