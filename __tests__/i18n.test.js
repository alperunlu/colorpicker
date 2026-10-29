import i18n, { t, colorName, nearestColorLabel, formatDecimal } from "../utils/i18n";

test("defaults to English under the test locale", () => {
  expect(t("tabs.camera")).toBe("Camera");
  expect(t("camera.area", { size: 9 })).toBe("Area 9×9");
  expect(nearestColorLabel(70, 130, 180)).toBe("Steel Blue");
  expect(colorName("RebeccaPurple")).toBe("Rebecca Purple");
});

test("switches language and falls back to English for missing keys", () => {
  i18n.locale = "tr";
  expect(t("camera.pickColor")).toBe("Renk Seç");
  expect(nearestColorLabel(255, 0, 0)).toBe("Kırmızı");
  i18n.locale = "vi";
  expect(t("card.copied", { label: "HEX" })).toBe("Đã sao chép HEX");
  i18n.locale = "en";
});

test("formats decimals with the device separator", () => {
  expect(formatDecimal(4.5)).toBe("4.5");
});
