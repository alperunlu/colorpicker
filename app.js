import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Modal } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import WebView from "react-native-webview";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { StatusBar } from "expo-status-bar";

// Size of the square region sampled around the crosshair. Averaging a small
// region instead of reading one pixel smooths out camera sensor noise.
const SAMPLE_SIZE = 9;
const PROCESSING_TIMEOUT_MS = 10000;

const webViewHtml = (base64) => `
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <canvas id="canvas" style="display: none;"></canvas>
    <img id="image" style="display: none;" onload="processImage()" onerror="reportError()" />
    <script>
      const image = document.getElementById('image');
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      image.src = "data:image/png;base64,${base64}";

      function reportError() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ error: true }));
      }

      function processImage() {
        try {
          canvas.width = image.width;
          canvas.height = image.height;
          ctx.drawImage(image, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let r = 0, g = 0, b = 0;
          const count = data.length / 4;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
          }
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          window.ReactNativeWebView.postMessage(JSON.stringify({ r, g, b }));
        } catch (e) {
          reportError();
        }
      }
    </script>
  </body>
  </html>
`;

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [color, setColor] = useState(null);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);
  const timeoutRef = useRef(null);
  const copiedTimerRef = useRef(null);
  const [facing, setFacing] = useState('back');
  const [torch, setTorch] = useState(false);
  const [htmlContent, setHtmlContent] = useState(webViewHtml(""));
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState(null);

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const rgbToHex = (r, g, b) =>
    ("#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)).toUpperCase();

  const rgbToCmyk = (r, g, b) => {
    let c = 1 - r / 255;
    let m = 1 - g / 255;
    let y = 1 - b / 255;
    const k = Math.min(c, m, y);
    if (k === 1) {
      return { c: "0", m: "0", y: "0", k: "100" };
    }
    c = ((c - k) / (1 - k) * 100).toFixed(0);
    m = ((m - k) / (1 - k) * 100).toFixed(0);
    y = ((y - k) / (1 - k) * 100).toFixed(0);
    return { c, m, y, k: (k * 100).toFixed(0) };
  };

  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  const hslToRgb = (h, s, l) => {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  };

  const generatePalette = (r, g, b) => {
    const hsl = rgbToHsl(r, g, b);
    const palette = [];

    const analogous1 = hslToRgb((hsl.h + 45) % 360, hsl.s, hsl.l);
    const analogous2 = hslToRgb((hsl.h - 45 + 360) % 360, hsl.s, hsl.l);
    const lightened = hslToRgb(hsl.h, hsl.s, Math.min(100, hsl.l + 20));
    const darkened = hslToRgb(hsl.h, hsl.s, Math.max(0, hsl.l - 20));

    palette.push(rgbToHex(lightened.r, lightened.g, lightened.b));
    palette.push(rgbToHex(analogous1.r, analogous1.g, analogous1.b));
    palette.push(rgbToHex(r, g, b));
    palette.push(rgbToHex(analogous2.r, analogous2.g, analogous2.b));
    palette.push(rgbToHex(darkened.r, darkened.g, darkened.b));

    return palette;
  };

  const buildColor = (r, g, b, palette) => {
    const hsl = rgbToHsl(r, g, b);
    return {
      r, g, b,
      hex: rgbToHex(r, g, b),
      cmyk: rgbToCmyk(r, g, b),
      hsl: {
        h: hsl.h.toFixed(0),
        s: hsl.s.toFixed(0),
        l: hsl.l.toFixed(0),
      },
      palette: palette || generatePalette(r, g, b),
    };
  };

  const handleWebViewMessage = (event) => {
    clearTimeout(timeoutRef.current);
    try {
      const { r, g, b, error } = JSON.parse(event.nativeEvent.data);
      if (error || typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number' || isNaN(r) || isNaN(g) || isNaN(b)) {
        throw new Error("Invalid color data received.");
      }
      setColor(buildColor(r, g, b));
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error processing WebView message:", error);
      setLoading(false);
      Alert.alert("Error", "Could not retrieve color information.");
    }
  };

  const pickColor = async () => {
    if (!cameraRef.current || !isCameraReady) {
      Alert.alert("Camera Not Ready", "Please wait a moment and try again.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setColor(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      const sampleSize = Math.min(SAMPLE_SIZE, photo.width, photo.height);
      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{
          crop: {
            originX: Math.max(0, Math.round((photo.width - sampleSize) / 2)),
            originY: Math.max(0, Math.round((photo.height - sampleSize) / 2)),
            width: sampleSize,
            height: sampleSize,
          }
        }],
        { format: ImageManipulator.SaveFormat.PNG, base64: true }
      );

      if (!manipResult.base64) {
        throw new Error("Base64 data not found after manipulation.");
      }

      setHtmlContent(webViewHtml(manipResult.base64));

      timeoutRef.current = setTimeout(() => {
        setLoading(false);
        Alert.alert("Error", "Color processing timed out. Please try again.");
      }, PROCESSING_TIMEOUT_MS);

    } catch (error) {
      console.error("Error picking color:", error);
      setLoading(false);
      Alert.alert("Error", "Failed to capture image.");
    }
  };

  const handlePalettePress = (hexCode) => {
    const { r, g, b } = hexToRgb(hexCode);
    setColor(buildColor(r, g, b, color.palette));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const copyToClipboard = async (label, value) => {
    try {
      await Clipboard.setStringAsync(value);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      clearTimeout(copiedTimerRef.current);
      setCopiedLabel(label);
      copiedTimerRef.current = setTimeout(() => setCopiedLabel(null), 1200);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}><Text style={styles.loadingText}>Loading...</Text></View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.message}>Camera permission required to capture colors</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            accessibilityLabel="Grant camera permission"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function toggleTorch() {
    setTorch(current => !current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          ref={cameraRef}
          facing={facing}
          enableTorch={torch}
          onCameraReady={() => setIsCameraReady(true)}
        />

        {loading && (
          <Modal visible transparent>
            <WebView
              source={{ html: htmlContent }}
              onMessage={handleWebViewMessage}
              onError={() => {
                clearTimeout(timeoutRef.current);
                setLoading(false);
                Alert.alert("Error", "Could not process the image.");
              }}
              style={{
                width: 1,
                height: 1,
                opacity: 0,
                backgroundColor: "transparent",
                pointerEvents: "none",
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </Modal>
        )}

        <View style={styles.crosshair} pointerEvents="none" accessibilityLabel="Color picker crosshair">
          <View style={styles.crossLineVertical} />
          <View style={styles.crossLineHorizontal} />
          <View style={styles.centerDot} />
        </View>

        <View style={styles.topButtonsContainer}>
          <TouchableOpacity
            style={[styles.iconButton, torch && styles.iconButtonActive]}
            onPress={toggleTorch}
            accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
            accessibilityRole="button"
          >
            <Text style={styles.iconButtonText}>{torch ? "Torch On" : "Torch Off"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={toggleCameraFacing}
            accessibilityLabel="Flip camera"
            accessibilityRole="button"
          >
            <Text style={styles.iconButtonText}>Flip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={pickColor}
            disabled={loading}
            accessibilityLabel="Pick color from camera"
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Pick Color</Text>
            )}
          </TouchableOpacity>
        </View>

        {color && (
          <View style={styles.colorInfo} accessible={false}>
            <View style={styles.colorPreviewContainer}>
              <View style={[styles.colorPreview, { backgroundColor: color.hex }]} />
              <View style={styles.colorValues}>
                <TouchableOpacity
                  onPress={() => copyToClipboard("HEX", color.hex)}
                  accessibilityLabel={`Copy hex value ${color.hex}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.hexText}>{color.hex}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => copyToClipboard("RGB", `rgb(${color.r}, ${color.g}, ${color.b})`)}
                  accessibilityLabel="Copy RGB value"
                  accessibilityRole="button"
                >
                  <Text style={styles.infoText}>RGB  {color.r}, {color.g}, {color.b}</Text>
                </TouchableOpacity>
              </View>
              {copiedLabel && (
                <View style={styles.copiedBadge}>
                  <Text style={styles.copiedText}>{copiedLabel} copied</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={() => copyToClipboard("HSL", `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`)}
              accessibilityLabel="Copy HSL value"
              accessibilityRole="button"
            >
              <Text style={styles.infoText}>HSL  {color.hsl.h}°, {color.hsl.s}%, {color.hsl.l}%</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => copyToClipboard("CMYK", `cmyk(${color.cmyk.c}%, ${color.cmyk.m}%, ${color.cmyk.y}%, ${color.cmyk.k}%)`)}
              accessibilityLabel="Copy CMYK value"
              accessibilityRole="button"
            >
              <Text style={styles.infoText}>CMYK  {color.cmyk.c}%, {color.cmyk.m}%, {color.cmyk.y}%, {color.cmyk.k}%</Text>
            </TouchableOpacity>

            <Text style={styles.paletteTitle}>Palette</Text>
            <View style={styles.paletteContainer}>
              {color.palette.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handlePalettePress(p)}
                  style={[styles.paletteColor, { backgroundColor: p }, p === color.hex && styles.paletteColorSelected]}
                  accessibilityLabel={`Select color ${p}`}
                  accessibilityRole="button"
                />
              ))}
            </View>
            <Text style={styles.hintText}>Tap a value to copy it</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 20,
    fontSize: 16,
    color: "#fff",
  },
  permissionButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  topButtonsContainer: {
    position: "absolute",
    top: 16,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  iconButtonActive: {
    backgroundColor: "rgba(255, 200, 0, 0.35)",
    borderColor: "rgba(255, 200, 0, 0.8)",
  },
  iconButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  buttonsContainer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    minWidth: 180,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  colorInfo: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "rgba(18, 18, 18, 0.92)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  colorPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  colorValues: {
    flex: 1,
  },
  colorPreview: {
    width: 52,
    height: 52,
    borderRadius: 10,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  copiedBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  copiedText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  hexText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "#fff",
    marginBottom: 2,
  },
  infoText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 4,
    fontVariant: ["tabular-nums"],
  },
  paletteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: "#fff",
    marginTop: 8,
    marginBottom: 8,
  },
  paletteContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paletteColor: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  paletteColorSelected: {
    borderWidth: 2,
    borderColor: "#fff",
  },
  hintText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.45)",
    marginTop: 10,
    textAlign: "center",
  },
  crosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 60,
    height: 60,
    marginLeft: -30,
    marginTop: -30,
    justifyContent: "center",
    alignItems: "center",
  },
  crossLineVertical: {
    position: "absolute",
    width: 2,
    height: 60,
    backgroundColor: "white",
    opacity: 0.8,
  },
  crossLineHorizontal: {
    position: "absolute",
    width: 60,
    height: 2,
    backgroundColor: "white",
    opacity: 0.8,
  },
  centerDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "red",
    borderWidth: 1,
    borderColor: "white",
  },
});
