import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Linking } from "react-native";
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

// Loaded once and kept mounted for the app's lifetime. Reloading the WebView's
// `source` on every capture (the previous approach) meant a brand-new WKWebView
// had to spin up on the very first press (slow enough to fail) and left the
// previous page's in-flight script able to deliver a late, stale result after
// the next capture had already started. Keeping one persistent page and just
// postMessage-ing new work into it avoids both problems; each request carries
// a requestId so any late/stale response can be identified and ignored.
const WEBVIEW_HTML = `
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <canvas id="canvas" style="display: none;"></canvas>
    <script>
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');

      function handleIncoming(raw) {
        var msg;
        try { msg = JSON.parse(raw); } catch (e) { return; }
        var requestId = msg.requestId;
        var image = new Image();
        image.onload = function () {
          try {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
            var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            var r = 0, g = 0, b = 0;
            var count = data.length / 4;
            for (var i = 0; i < data.length; i += 4) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
            }
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);
            window.ReactNativeWebView.postMessage(JSON.stringify({ r: r, g: g, b: b, requestId: requestId }));
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ error: true, requestId: requestId }));
          }
        };
        image.onerror = function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({ error: true, requestId: requestId }));
        };
        image.src = "data:image/png;base64," + msg.base64;
      }

      // react-native-webview dispatches injected messages on window for iOS
      // and on document for Android; listen on both to be safe everywhere.
      window.addEventListener('message', function (event) { handleIncoming(event.data); });
      document.addEventListener('message', function (event) { handleIncoming(event.data); });
    </script>
  </body>
  </html>
`;

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [color, setColor] = useState(null);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);
  const webViewRef = useRef(null);
  const timeoutRef = useRef(null);
  const copiedTimerRef = useRef(null);
  const [facing, setFacing] = useState('back');
  const [torch, setTorch] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState(null);
  // Identifies the in-flight capture. Bumped on every pickColor() call; any
  // WebView response whose requestId doesn't match the current value is a
  // stale result from a previous capture and gets ignored.
  const requestIdRef = useRef(0);
  const activeRequestIdRef = useRef(null);

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
    let parsed;
    try {
      parsed = JSON.parse(event.nativeEvent.data);
    } catch (error) {
      return; // Malformed payload; nothing we can do with it.
    }

    const { r, g, b, error, requestId } = parsed;
    if (requestId !== activeRequestIdRef.current) {
      return; // Stale response from an earlier capture; ignore it.
    }

    clearTimeout(timeoutRef.current);

    if (error || typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number' || isNaN(r) || isNaN(g) || isNaN(b)) {
      setLoading(false);
      Alert.alert("Error", "Could not retrieve color information.");
      return;
    }

    setColor(buildColor(r, g, b));
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const pickColor = async () => {
    if (!cameraRef.current || !isCameraReady) {
      Alert.alert("Camera Not Ready", "Please wait a moment and try again.");
      return;
    }
    if (!isWebViewReady) {
      Alert.alert("Please Wait", "Still preparing color processing. Try again in a moment.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setColor(null);

    const requestId = ++requestIdRef.current;
    activeRequestIdRef.current = requestId;
    clearTimeout(timeoutRef.current);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        shutterSound: false,
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

      // A newer capture may have started while we were awaiting the camera/
      // manipulator; if so, drop this one instead of racing it against the
      // newer request.
      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      webViewRef.current?.postMessage(JSON.stringify({ base64: manipResult.base64, requestId }));

      timeoutRef.current = setTimeout(() => {
        if (activeRequestIdRef.current === requestId) {
          setLoading(false);
          Alert.alert("Error", "Color processing timed out. Please try again.");
        }
      }, PROCESSING_TIMEOUT_MS);

    } catch (error) {
      console.error("Error picking color:", error);
      if (activeRequestIdRef.current === requestId) {
        setLoading(false);
      }
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
    // Once the user denies the request once, iOS won't show the system
    // prompt again — requestPermission() would just silently resolve to
    // denied, leaving the button dead. Send them to Settings instead.
    const canAskAgain = permission.canAskAgain;
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.message}>Camera permission required to capture colors</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={canAskAgain ? requestPermission : () => Linking.openSettings()}
            accessibilityLabel={canAskAgain ? "Grant camera permission" : "Open Settings to grant camera permission"}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{canAskAgain ? "Grant Permission" : "Open Settings"}</Text>
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

        <WebView
          ref={webViewRef}
          source={{ html: WEBVIEW_HTML }}
          onLoadEnd={() => setIsWebViewReady(true)}
          onMessage={handleWebViewMessage}
          onError={() => {
            setIsWebViewReady(false);
            const requestId = activeRequestIdRef.current;
            if (requestId !== null) {
              clearTimeout(timeoutRef.current);
              setLoading(false);
              Alert.alert("Error", "Could not process the image.");
            }
          }}
          style={{
            width: 1,
            height: 1,
            opacity: 0,
            position: "absolute",
            top: -1000,
            left: -1000,
            backgroundColor: "transparent",
          }}
          pointerEvents="none"
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />

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
