# ColorPicker

A real-world color picker app built with Expo. Point your camera at any object to capture its color and get RGB, HEX, CMYK values along with a harmonious color palette.

## Features

- Real-time color capture via camera
- RGB, HEX, and CMYK color values
- Analogous color palette generation
- Light and dark shade preview
- Crosshair targeting for precise color selection
- Front/back camera toggle

## Tech Stack

- React Native 0.79 + Expo 53
- expo-camera for camera access
- expo-image-manipulator for pixel extraction
- react-native-webview for color data processing

## Build & Deploy

```bash
# Install dependencies
npm install

# Start development
npm start

# Build for iOS (requires EAS)
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to App Store
eas submit --platform ios --profile production
```

## Configuration

Before building for production, update `eas.json` with your Apple Developer credentials:
- `appleId`: Your Apple ID
- `ascAppId`: Your App Store Connect app ID
- `appleTeamId`: Your Apple Developer Team ID
