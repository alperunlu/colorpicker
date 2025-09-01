# Camera Color Picker 🎨

This is a simple, yet powerful, React Native application that turns your phone's camera into a live color detector. Point your camera at any object and tap a button to instantly get its color codes and a harmonious color palette for your next design project.

---

## ✨ Features

* **Real-time Color Picking:** Use your phone's camera to capture a pixel and get its exact color.
* **Multiple Color Formats:** Instantly view the color in **HEX**, **RGB**, and **CMYK** formats.
* **Harmonious Color Palette:** The app generates a compatible color palette based on your chosen color using a harmony algorithm, providing a great starting point for visual designs.
* **Interactive Palette:** Tap on any color in the generated palette to see its individual color codes.
* **Front/Back Camera Toggle:** Easily switch between the front and back cameras.
* **User-Friendly UI:** A clean, minimal interface with a center crosshair to help you target the desired color.

---

## 📸 How It Works

The app uses `expo-camera` to access the live camera feed. When you tap "Pick Color," it captures a single-pixel screenshot at the center of the crosshair. This tiny 1x1 pixel image is then processed using a hidden `WebView` and JavaScript to extract its RGB values.

The RGB data is then used to calculate the HEX and CMYK codes. A custom algorithm uses the color's hue to generate a harmonious palette of complementary and analogous colors, which are perfect for visual design.
