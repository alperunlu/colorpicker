import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Button, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import WebView from "react-native-webview";

const { width, height } = Dimensions.get("window");

const webViewHtml = (base64) => `
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <canvas id="canvas" style="display: none;"></canvas>
    <img id="image" style="display: none;" onload="processImage()" />
    <script>
      const image = document.getElementById('image');
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      image.src = "data:image/png;base64,${base64}";

      function processImage() {
        canvas.width = 1;
        canvas.height = 1;
        ctx.drawImage(image, 0, 0, 1, 1);
        const pixelData = ctx.getImageData(0, 0, 1, 1).data;
        const r = pixelData[0];
        const g = pixelData[1];
        const b = pixelData[2];

        window.ReactNativeWebView.postMessage(JSON.stringify({ r, g, b }));
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
  const [facing, setFacing] = useState('back');
  const [htmlContent, setHtmlContent] = useState(webViewHtml(""));

  const rgbToHex = (r, g, b) =>
    "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

  const rgbToCmyk = (r, g, b) => {
    let c = 1 - r / 255;
    let m = 1 - g / 255;
    let y = 1 - b / 255;
    let k = Math.min(c, m, y);
    c = ((c - k) / (1 - k) * 100).toFixed(0);
    m = ((m - k) / (1 - k) * 100).toFixed(0);
    y = ((y - k) / (1 - k) * 100).toFixed(0);
    k = (k * 100).toFixed(0);
    return { c, m, y, k };
  };

  const generatePalette = (r, g, b) => {
    const hex = rgbToHex(r, g, b);
    const palette = [hex];
    for (let i = 1; i < 5; i++) {
      const factor = i * 0.15;
      const nr = Math.min(255, Math.max(0, Math.round(r * (1 - factor))));
      const ng = Math.min(255, Math.max(0, Math.round(g * (1 - factor))));
      const nb = Math.min(255, Math.max(0, Math.round(b * (1 - factor))));
      palette.push(rgbToHex(nr, ng, nb));
    }
    return palette;
  };

  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const handleWebViewMessage = (event) => {
    try {
      const { r, g, b } = JSON.parse(event.nativeEvent.data);
      if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number' || isNaN(r) || isNaN(g) || isNaN(b)) {
        throw new Error("Invalid color data received.");
      }
      const newColor = {
        r, g, b,
        hex: rgbToHex(r, g, b),
        cmyk: rgbToCmyk(r, g, b),
        palette: generatePalette(r, g, b),
      };
      setColor(newColor);
      setLoading(false);
    } catch (error) {
      console.error("Error processing WebView message:", error);
      setLoading(false);
      Alert.alert("Error", "Could not retrieve color information.");
    }
  };

  const pickColor = async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    setColor(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        base64: true,
      });

      const cropSize = 1; 
      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{
          crop: {
            originX: Math.max(0, photo.width / 2 - cropSize / 2),
            originY: Math.max(0, photo.height / 2 - cropSize / 2),
            width: cropSize,
            height: cropSize,
          }
        },
        { resize: { width: 1, height: 1 } }],
        { format: ImageManipulator.SaveFormat.PNG, compress: 1, base64: true }
      );
      
      if (!manipResult.base64) {
        throw new Error("Base64 data not found after manipulation.");
      }

      setHtmlContent(webViewHtml(manipResult.base64));

    } catch (error) {
      console.error("Error picking color:", error);
      setLoading(false);
      Alert.alert("Error", "Failed to capture image.");
    }
  };

  const handlePalettePress = (hexCode) => {
    const { r, g, b } = hexToRgb(hexCode);
    setColor({
      r, g, b,
      hex: hexCode,
      cmyk: rgbToCmyk(r, g, b),
      palette: color.palette,
    });
  };

  if (!permission) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  const hasPermission = permission.granted;

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission required</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView 
        style={{ flex: 1 }} 
        ref={cameraRef}
        facing={facing}
      />
      
      {loading && (
        <WebView 
          source={{ html: htmlContent }} 
          onMessage={handleWebViewMessage}
          style={{ 
            height: 1, 
            width: 1, 
            position: 'absolute', 
            top: -1000, 
            opacity: 0,
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      )}

      <View style={styles.crosshair}>
        <View style={styles.crossLineVertical} />
        <View style={styles.crossLineHorizontal} />
        <View style={styles.centerDot} />
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.button} onPress={pickColor} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Pick Color</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
          <Text style={styles.buttonText}>Flip Camera</Text>
        </TouchableOpacity>
      </View>

      {color && (
        <View style={styles.colorInfo}>
          <View style={styles.colorPreviewContainer}>
            <View style={[styles.colorPreview, { backgroundColor: color.hex }]} />
            <View>
              <Text style={styles.hexText}>{color.hex}</Text>
              <Text style={styles.rgbText}>RGB: {color.r}, {color.g}, {color.b}</Text>
            </View>
          </View>
          
          <Text style={styles.infoText}>CMYK: {color.cmyk.c}%, {color.cmyk.m}%, {color.cmyk.y}%, {color.cmyk.k}%</Text>
          
          <Text style={styles.paletteTitle}>Color Palette:</Text>
          <View style={styles.paletteContainer}>
            {color.palette.map((p, i) => (
              <TouchableOpacity key={i} onPress={() => handlePalettePress(p)} style={[styles.paletteColor, { backgroundColor: p }]} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 20,
    fontSize: 16,
  },
  buttonsContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  button: {
    backgroundColor: "rgba(0, 0, 255, 0.8)",
    padding: 15,
    borderRadius: 10,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  flipButton: {
    backgroundColor: "rgba(0, 128, 0, 0.8)",
    padding: 15,
    borderRadius: 10,
    minWidth: 120,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  colorInfo: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  colorPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  colorPreview: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  hexText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  rgbText: {
    fontSize: 12,
    color: '#666',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
  },
  paletteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  paletteContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paletteColor: {
    width: 30,
    height: 30,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
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
