import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import ColorCard from "../components/ColorCard";
import { sampleColor, SAMPLE_SIZES } from "../utils/sample";
import { t } from "../utils/i18n";

export default function CameraScreen({
  sampleSize,
  onChangeSampleSize,
  rgb,
  onPick,
  onChangeRgb,
  paletteType,
  onChangePaletteType,
  isFavorite,
  onToggleFavorite,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [facing, setFacing] = useState("back");
  const [torch, setTorch] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef(null);

  if (!permission) {
    return (
      <View style={styles.center}><Text style={styles.loadingText}>{t("common.loading")}</Text></View>
    );
  }

  if (!permission.granted) {
    // Once the user denies the request once, iOS won't show the system
    // prompt again — requestPermission() would just silently resolve to
    // denied, leaving the button dead. Send them to Settings instead.
    const canAskAgain = permission.canAskAgain;
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t("camera.permissionRequired")}</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={canAskAgain ? requestPermission : () => Linking.openSettings()}
          accessibilityLabel={canAskAgain ? t("camera.grantPermissionA11y") : t("camera.openSettingsA11y")}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{canAskAgain ? t("camera.continue") : t("camera.openSettings")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pickColor = async () => {
    if (!cameraRef.current || !isCameraReady) {
      Alert.alert(t("camera.notReadyTitle"), t("camera.notReadyMessage"));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, shutterSound: false });
      const picked = await sampleColor(
        photo.uri,
        { width: photo.width, height: photo.height },
        photo.width / 2,
        photo.height / 2,
        sampleSize
      );
      onPick(picked);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error picking color:", error);
      Alert.alert(t("common.error"), t("camera.captureFailed"));
    } finally {
      setLoading(false);
    }
  };

  const cycleSampleSize = () => {
    const next = SAMPLE_SIZES[(SAMPLE_SIZES.indexOf(sampleSize) + 1) % SAMPLE_SIZES.length];
    onChangeSampleSize(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.flex}>
      <CameraView
        // Explicit absolute fill instead of flex:1 — under the New Architecture,
        // CameraView's native view has been observed to not reliably pick up a
        // flex-computed height (it settles for its own smaller intrinsic size,
        // leaving the rest of the screen black). Pinning all four edges sidesteps
        // that measurement path entirely.
        style={StyleSheet.absoluteFillObject}
        ref={cameraRef}
        facing={facing}
        enableTorch={torch}
        onCameraReady={() => setIsCameraReady(true)}
      />

      <View style={styles.crosshair} pointerEvents="none" accessibilityLabel={t("camera.crosshairA11y")}>
        <View style={styles.crossLineVertical} />
        <View style={styles.crossLineHorizontal} />
        <View style={styles.centerDot} />
      </View>

      <View style={styles.topButtons}>
        <TouchableOpacity
          style={[styles.iconButton, torch && styles.iconButtonActive]}
          onPress={() => { setTorch((t) => !t); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          accessibilityLabel={torch ? t("camera.turnTorchOffA11y") : t("camera.turnTorchOnA11y")}
          accessibilityRole="button"
        >
          <Text style={styles.iconButtonText} numberOfLines={1} adjustsFontSizeToFit>{torch ? t("camera.torchOn") : t("camera.torchOff")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={cycleSampleSize}
          accessibilityLabel={t("camera.areaA11y", { size: sampleSize })}
          accessibilityRole="button"
        >
          <Text style={styles.iconButtonText} numberOfLines={1} adjustsFontSizeToFit>{t("camera.area", { size: sampleSize })}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            setFacing((f) => (f === "back" ? "front" : "back"));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          accessibilityLabel={t("camera.flipA11y")}
          accessibilityRole="button"
        >
          <Text style={styles.iconButtonText} numberOfLines={1} adjustsFontSizeToFit>{t("camera.flip")}</Text>
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
          />
        </View>
      )}

      <View style={styles.buttonWrap}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={pickColor}
          disabled={loading}
          accessibilityLabel={t("camera.pickColorA11y")}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("camera.pickColor")}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  loadingText: { color: "#fff", fontSize: 16 },
  message: { textAlign: "center", paddingBottom: 20, fontSize: 16, color: "#fff" },
  permissionButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)", paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.3)",
  },
  topButtons: {
    position: "absolute", top: 16, left: 20, right: 20,
    flexDirection: "row", justifyContent: "space-between", gap: 8,
  },
  // flexShrink keeps long translations from pushing the row off narrow screens.
  iconButton: {
    flexShrink: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)", paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.25)",
  },
  iconButtonActive: { backgroundColor: "rgba(255, 200, 0, 0.35)", borderColor: "rgba(255, 200, 0, 0.8)" },
  iconButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  buttonWrap: { position: "absolute", bottom: 24, left: 0, right: 0, alignItems: "center" },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.15)", paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: 30, minWidth: 180, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.4)",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cardWrap: { position: "absolute", bottom: 100, left: 20, right: 20 },
  crosshair: {
    position: "absolute", top: "50%", left: "50%", width: 60, height: 60,
    marginLeft: -30, marginTop: -30, justifyContent: "center", alignItems: "center",
  },
  crossLineVertical: { position: "absolute", width: 2, height: 60, backgroundColor: "white", opacity: 0.8 },
  crossLineHorizontal: { position: "absolute", width: 60, height: 2, backgroundColor: "white", opacity: 0.8 },
  centerDot: {
    position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: "red",
    borderWidth: 1, borderColor: "white",
  },
});
