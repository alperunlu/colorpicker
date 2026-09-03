# ColorPicker

A real-world color picker app built with Expo. Point your camera at any object to capture its color and get RGB, HEX, CMYK values along with a harmonious color palette.

## Features

- Real-time color capture via camera
- HEX, RGB, HSL, and CMYK color values
- Tap any value to copy it to the clipboard
- Analogous color palette generation
- Light and dark shade preview
- Crosshair targeting with 9x9 pixel averaging for noise-free readings
- Torch toggle for low-light picking
- Front/back camera toggle

## Tech Stack

- React Native 0.81 + Expo SDK 54
- expo-camera for camera access
- expo-image-manipulator for pixel extraction
- react-native-webview for color data processing
- expo-clipboard and expo-haptics for interaction feedback
