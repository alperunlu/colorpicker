# ColorPicker

A real-world color picker app built with Expo. Point your camera at any object, or pick a photo from your library, to capture its color and get its values, name and a matching palette.

## Features

- Pick colors from the camera or from any photo in your library (tap anywhere on the photo)
- HEX, RGB, HSL, HSV, and CMYK values — tap any value to copy it
- Nearest color name (offline, CSS named colors)
- WCAG contrast ratio against white and black text
- Palettes: analogous, complementary, triadic, tetradic, monochromatic
- History of picked colors, with favorites (kept across launches)
- Adjustable sample area (1×1, 9×9, 25×25 pixels) to smooth out sensor noise
- Torch toggle for low-light picking, front/back camera toggle

## Tech Stack

- React Native 0.81 + Expo SDK 54
- expo-camera, expo-image-picker, expo-image-manipulator for capturing and cropping pixels
- upng-js to decode the cropped PNG in plain JS (no WebView)
- @react-native-async-storage/async-storage for history and favorites
- expo-clipboard and expo-haptics for interaction feedback

## Project layout

- `App.js` — tabs and shared state (current color, history)
- `screens/` — Camera, Photo, and History screens
- `components/ColorCard.js` — color details panel
- `utils/` — pure logic: color math, color names, pixel decoding, sampling, history helpers

## Development

```
npm install
npm start      # Expo Go works; no custom native code
npm test       # unit tests for the pure logic in utils/
```
