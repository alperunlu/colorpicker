import * as ImageManipulator from "expo-image-manipulator";
import { averageRgbFromPngBase64 } from "./pixels";

export const SAMPLE_SIZE = 9;

// Maps a touch inside a box that shows an image with resizeMode="contain" back
// to pixel coordinates in the image. Returns null for touches on the letterbox.
export const viewToImageCoords = (x, y, box, image) => {
  if (![x, y, box.width, box.height].every(Number.isFinite)) return null;
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const offsetX = (box.width - image.width * scale) / 2;
  const offsetY = (box.height - image.height * scale) / 2;
  const px = (x - offsetX) / scale;
  const py = (y - offsetY) / scale;
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) return null;
  return { x: px, y: py };
};

// Crops a size x size square centered on (cx, cy), clamped inside the image,
// and returns the average RGB of that square. Averaging a small region instead
// of reading one pixel smooths out camera sensor noise.
export const sampleColor = async (uri, image, cx, cy, size = SAMPLE_SIZE) => {
  const s = Math.max(1, Math.min(size, image.width, image.height));
  const originX = Math.min(Math.max(0, Math.round(cx - s / 2)), image.width - s);
  const originY = Math.min(Math.max(0, Math.round(cy - s / 2)), image.height - s);

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: s, height: s } }],
    { format: ImageManipulator.SaveFormat.PNG, base64: true }
  );
  if (!result.base64) {
    throw new Error("Base64 data not found after manipulation.");
  }
  return averageRgbFromPngBase64(result.base64);
};
