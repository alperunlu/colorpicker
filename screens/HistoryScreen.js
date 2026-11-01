import React, { useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import ColorCard from "../components/ColorCard";
import { hexToRgb } from "../utils/color";
import { t, nearestColorLabel } from "../utils/i18n";

export default function HistoryScreen({
  items,
  paletteType,
  onChangePaletteType,
  onBack,
  onToggleFavorite,
  onDelete,
  onClearNonFavorites,
}) {
  const [filter, setFilter] = useState("all"); // "all" | "favorites"
  const [selected, setSelected] = useState(null); // { hex, rgb }

  const visible = filter === "favorites" ? items.filter((i) => i.favorite) : items;
  const selectedItem = selected && items.find((i) => i.hex === selected.hex);

  const confirmClear = () => {
    Alert.alert(t("history.clearTitle"), t("history.clearMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("history.clear"), style: "destructive", onPress: onClearNonFavorites },
    ]);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel={t("common.back")}>
          <Text style={styles.backText}>‹ {t("common.back")}</Text>
        </TouchableOpacity>
        {["all", "favorites"].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
          >
            <Text style={styles.chipText}>{f === "all" ? t("history.all") : t("history.favorites")}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.flex} />
        {items.some((i) => !i.favorite) && (
          <TouchableOpacity onPress={confirmClear} accessibilityRole="button" accessibilityLabel={t("history.clearA11y")}>
            <Text style={styles.clear}>{t("history.clear")}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.hex}
        contentContainerStyle={[styles.list, selected && { paddingBottom: 320 }]}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === "favorites" ? t("history.emptyFavorites") : t("history.emptyAll")}
          </Text>
        }
        renderItem={({ item }) => {
          const { r, g, b } = hexToRgb(item.hex);
          const name = nearestColorLabel(r, g, b);
          return (
          <TouchableOpacity
            style={[styles.row, selected?.hex === item.hex && styles.rowActive]}
            onPress={() => setSelected({ hex: item.hex, rgb: hexToRgb(item.hex) })}
            accessibilityRole="button"
            accessibilityLabel={`${name} ${item.hex}`}
          >
            <View style={[styles.swatch, { backgroundColor: item.hex }]} />
            <View style={styles.flex}>
              <Text style={styles.hex}>{item.hex}</Text>
              <Text style={styles.name}>{name}</Text>
            </View>
            {item.favorite && <Text style={styles.star}>★</Text>}
          </TouchableOpacity>
          );
        }}
      />

      {selected && (
        <View style={styles.cardWrap}>
          <ColorCard
            opaque
            rgb={selected.rgb}
            paletteType={paletteType}
            onChangePaletteType={onChangePaletteType}
            onChangeRgb={(rgb) => setSelected({ hex: selected.hex, rgb })}
            isFavorite={!!selectedItem?.favorite}
            onToggleFavorite={() => onToggleFavorite(selected.hex)}
            onClose={() => setSelected(null)}
            onDelete={selectedItem ? () => { onDelete(selected.hex); setSelected(null); } : undefined}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { paddingRight: 12, paddingVertical: 6 },
  backText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, marginRight: 8,
    borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.25)",
  },
  chipActive: { backgroundColor: "rgba(255, 255, 255, 0.25)", borderColor: "#fff" },
  chipText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  clear: { color: "#ff6b6b", fontSize: 13, fontWeight: "600" },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { color: "rgba(255, 255, 255, 0.55)", textAlign: "center", marginTop: 48, fontSize: 14 },
  row: {
    flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.1)",
  },
  rowActive: { borderColor: "#fff", backgroundColor: "rgba(255, 255, 255, 0.08)" },
  swatch: {
    width: 44, height: 44, borderRadius: 8, marginRight: 12,
    borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.3)",
  },
  hex: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  name: { color: "rgba(255, 255, 255, 0.6)", fontSize: 12, marginTop: 2 },
  star: { color: "#FFC800", fontSize: 20, marginLeft: 8 },
  cardWrap: { position: "absolute", bottom: 12, left: 20, right: 20 },
});
