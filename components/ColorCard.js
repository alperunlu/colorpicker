import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { buildColor, contrastInfo, PALETTE_TYPES, hexToRgb } from "../utils/color";
import { t, nearestColorLabel, formatDecimal } from "../utils/i18n";

// Details panel for one picked color. Controlled: the parent owns the rgb value
// and the palette type; picking a palette swatch calls onChangeRgb.
// Laid out to fit without scrolling: values in two columns and a single
// "‹ palette ›" switcher instead of a row of chips.
export default function ColorCard({
  rgb,
  paletteType,
  onChangePaletteType,
  onChangeRgb,
  isFavorite,
  onToggleFavorite,
  onDelete,
  onClose,
  opaque,
}) {
  const [copiedLabel, setCopiedLabel] = useState(null);
  const copiedTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

  const color = buildColor(rgb.r, rgb.g, rgb.b, paletteType);
  const name = nearestColorLabel(rgb.r, rgb.g, rgb.b);
  const contrast = contrastInfo(rgb.r, rgb.g, rgb.b);

  const copy = async (label, value) => {
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

  const values = [
    ["RGB", `rgb(${color.r}, ${color.g}, ${color.b})`, `${color.r}, ${color.g}, ${color.b}`],
    ["HSL", `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`, `${color.hsl.h}°, ${color.hsl.s}%, ${color.hsl.l}%`],
    ["HSV", `hsv(${color.hsv.h}, ${color.hsv.s}%, ${color.hsv.v}%)`, `${color.hsv.h}°, ${color.hsv.s}%, ${color.hsv.v}%`],
    ["CMYK", `cmyk(${color.cmyk.c}%, ${color.cmyk.m}%, ${color.cmyk.y}%, ${color.cmyk.k}%)`, `${color.cmyk.c}, ${color.cmyk.m}, ${color.cmyk.y}, ${color.cmyk.k}`],
  ];

  const fmt = (c) => `${formatDecimal(c.ratio)}:1 ${c.level === "Fail" ? t("card.fail") : c.level}`;

  const typeIndex = Math.max(0, PALETTE_TYPES.indexOf(paletteType));
  const stepPalette = (delta) => {
    const next = PALETTE_TYPES[(typeIndex + delta + PALETTE_TYPES.length) % PALETTE_TYPES.length];
    onChangePaletteType(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.card, opaque && styles.cardOpaque]}>
      <View style={styles.header}>
        <View style={[styles.swatch, { backgroundColor: color.hex }]} />
        <View style={styles.headerText}>
          <TouchableOpacity
            onPress={() => copy("HEX", color.hex)}
            accessibilityLabel={t("card.copyHexA11y", { hex: color.hex })}
            accessibilityRole="button"
          >
            <Text style={styles.hex}>{color.hex}</Text>
          </TouchableOpacity>
          <Text style={styles.name} numberOfLines={1} accessibilityLabel={t("card.closestNameA11y", { name })}>{name}</Text>
        </View>
        {copiedLabel && (
          <View style={styles.badge}><Text style={styles.badgeText}>{t("card.copied", { label: copiedLabel })}</Text></View>
        )}
        <TouchableOpacity
          onPress={onToggleFavorite}
          style={styles.iconButton}
          accessibilityLabel={isFavorite ? t("card.removeFavoriteA11y") : t("card.addFavoriteA11y")}
          accessibilityRole="button"
        >
          <Text style={[styles.star, isFavorite && styles.starActive]}>{isFavorite ? "★" : "☆"}</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={styles.iconButton}
            accessibilityLabel={t("card.closeA11y")}
            accessibilityRole="button"
          >
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.grid}>
        {values.map(([label, copyValue, display]) => (
          <TouchableOpacity
            key={label}
            style={styles.cell}
            onPress={() => copy(label, copyValue)}
            accessibilityLabel={t("card.copyValueA11y", { label })}
            accessibilityRole="button"
          >
            <Text style={styles.info} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.label}>{label} </Text>{display}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.info} accessibilityLabel={t("card.contrastA11y")}>
        {t("card.contrast", { white: fmt(contrast.white), black: fmt(contrast.black) })}
      </Text>

      <View style={styles.switcher}>
        <TouchableOpacity
          onPress={() => stepPalette(-1)}
          style={styles.arrow}
          accessibilityLabel={t("card.prevPaletteA11y")}
          accessibilityRole="button"
        >
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.paletteName} numberOfLines={1} accessibilityLabel={t("card.paletteA11y", { type: t(`palette.${paletteType}`) })}>
          {t(`palette.${paletteType}`)}
        </Text>
        <TouchableOpacity
          onPress={() => stepPalette(1)}
          style={styles.arrow}
          accessibilityLabel={t("card.nextPaletteA11y")}
          accessibilityRole="button"
        >
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.palette}>
        {color.palette.map((hex, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              onChangeRgb(hexToRgb(hex));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[styles.paletteColor, { backgroundColor: hex }, hex === color.hex && styles.paletteSelected]}
            accessibilityLabel={t("card.selectColorA11y", { hex })}
            accessibilityRole="button"
          />
        ))}
      </View>

      <Text style={styles.hint}>{t("card.hint")}</Text>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} accessibilityRole="button" accessibilityLabel={t("card.deleteA11y")}>
          <Text style={styles.delete}>{t("card.delete")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(18, 18, 18, 0.94)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  // Over a list (not the camera) the translucent card lets rows bleed through.
  cardOpaque: { backgroundColor: "#121212" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  headerText: { flex: 1 },
  swatch: {
    width: 44, height: 44, borderRadius: 10, marginRight: 12,
    borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.3)",
  },
  hex: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  name: { fontSize: 13, color: "rgba(255, 255, 255, 0.65)", marginTop: 1 },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)", paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 12, marginRight: 4,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  iconButton: { paddingHorizontal: 8, paddingVertical: 4 },
  star: { fontSize: 24, color: "rgba(255, 255, 255, 0.6)" },
  starActive: { color: "#FFC800" },
  close: { fontSize: 20, color: "rgba(255, 255, 255, 0.75)", fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", paddingRight: 6, marginBottom: 4 },
  label: { color: "rgba(255, 255, 255, 0.5)", fontWeight: "600" },
  info: { fontSize: 13, color: "rgba(255, 255, 255, 0.85)", marginBottom: 4, fontVariant: ["tabular-nums"] },
  switcher: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6 },
  arrow: { paddingHorizontal: 18, paddingVertical: 2 },
  arrowText: { color: "#fff", fontSize: 26, fontWeight: "300", lineHeight: 28 },
  paletteName: { color: "#fff", fontSize: 14, fontWeight: "600", minWidth: 140, textAlign: "center" },
  palette: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  paletteColor: {
    width: 48, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.3)",
  },
  paletteSelected: { borderWidth: 2, borderColor: "#fff" },
  hint: { fontSize: 11, color: "rgba(255, 255, 255, 0.45)", marginTop: 8, textAlign: "center" },
  delete: { color: "#ff6b6b", fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 8 },
});
