import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { buildColor, contrastInfo, PALETTE_TYPES, hexToRgb } from "../utils/color";
import { nearestColorName } from "../utils/colorNames";

// Details panel for one picked color. Controlled: the parent owns the rgb value
// and the palette type; picking a palette swatch calls onChangeRgb.
export default function ColorCard({
  rgb,
  paletteType,
  onChangePaletteType,
  onChangeRgb,
  isFavorite,
  onToggleFavorite,
  onDelete,
}) {
  const { height } = useWindowDimensions();
  const [copiedLabel, setCopiedLabel] = useState(null);
  const copiedTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

  const color = buildColor(rgb.r, rgb.g, rgb.b, paletteType);
  const name = nearestColorName(rgb.r, rgb.g, rgb.b);
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

  const rows = [
    ["RGB", `rgb(${color.r}, ${color.g}, ${color.b})`, `${color.r}, ${color.g}, ${color.b}`],
    ["HSL", `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`, `${color.hsl.h}°, ${color.hsl.s}%, ${color.hsl.l}%`],
    ["HSV", `hsv(${color.hsv.h}, ${color.hsv.s}%, ${color.hsv.v}%)`, `${color.hsv.h}°, ${color.hsv.s}%, ${color.hsv.v}%`],
    ["CMYK", `cmyk(${color.cmyk.c}%, ${color.cmyk.m}%, ${color.cmyk.y}%, ${color.cmyk.k}%)`, `${color.cmyk.c}%, ${color.cmyk.m}%, ${color.cmyk.y}%, ${color.cmyk.k}%`],
  ];

  const fmt = (c) => `${c.ratio.toFixed(1)}:1 ${c.level}`;

  return (
    <View style={[styles.card, { maxHeight: height * 0.6 }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.swatch, { backgroundColor: color.hex }]} />
          <View style={styles.headerText}>
            <TouchableOpacity
              onPress={() => copy("HEX", color.hex)}
              accessibilityLabel={`Copy hex value ${color.hex}`}
              accessibilityRole="button"
            >
              <Text style={styles.hex}>{color.hex}</Text>
            </TouchableOpacity>
            <Text style={styles.name} accessibilityLabel={`Closest color name ${name}`}>{name}</Text>
          </View>
          {copiedLabel && (
            <View style={styles.badge}><Text style={styles.badgeText}>{copiedLabel} copied</Text></View>
          )}
          <TouchableOpacity
            onPress={onToggleFavorite}
            style={styles.starButton}
            accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
            accessibilityRole="button"
          >
            <Text style={[styles.star, isFavorite && styles.starActive]}>{isFavorite ? "★" : "☆"}</Text>
          </TouchableOpacity>
        </View>

        {rows.map(([label, copyValue, display]) => (
          <TouchableOpacity
            key={label}
            onPress={() => copy(label, copyValue)}
            accessibilityLabel={`Copy ${label} value`}
            accessibilityRole="button"
          >
            <Text style={styles.info}>{label}  {display}</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.info} accessibilityLabel="Text contrast">
          Contrast  white {fmt(contrast.white)}  ·  black {fmt(contrast.black)}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
          {PALETTE_TYPES.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => onChangePaletteType(t.id)}
              style={[styles.chip, paletteType === t.id && styles.chipActive]}
              accessibilityLabel={`${t.label} palette`}
              accessibilityRole="button"
              accessibilityState={{ selected: paletteType === t.id }}
            >
              <Text style={styles.chipText}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.palette}>
          {color.palette.map((hex, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                onChangeRgb(hexToRgb(hex));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[styles.paletteColor, { backgroundColor: hex }, hex === color.hex && styles.paletteSelected]}
              accessibilityLabel={`Select color ${hex}`}
              accessibilityRole="button"
            />
          ))}
        </View>

        <Text style={styles.hint}>Tap a value to copy it</Text>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete from history">
            <Text style={styles.delete}>Delete</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(18, 18, 18, 0.94)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  headerText: { flex: 1 },
  swatch: {
    width: 52, height: 52, borderRadius: 10, marginRight: 12,
    borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.3)",
  },
  hex: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  name: { fontSize: 13, color: "rgba(255, 255, 255, 0.65)", marginTop: 2 },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)", paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 12, marginRight: 6,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  starButton: { paddingHorizontal: 8, paddingVertical: 4 },
  star: { fontSize: 26, color: "rgba(255, 255, 255, 0.6)" },
  starActive: { color: "#FFC800" },
  info: { fontSize: 13, color: "rgba(255, 255, 255, 0.8)", marginBottom: 4, fontVariant: ["tabular-nums"] },
  typeRow: { marginTop: 8, flexGrow: 0 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8,
    borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.25)",
  },
  chipActive: { backgroundColor: "rgba(255, 255, 255, 0.25)", borderColor: "#fff" },
  chipText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  palette: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  paletteColor: {
    width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.3)",
  },
  paletteSelected: { borderWidth: 2, borderColor: "#fff" },
  hint: { fontSize: 11, color: "rgba(255, 255, 255, 0.45)", marginTop: 10, textAlign: "center" },
  delete: { color: "#ff6b6b", fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 10 },
});
