import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useApp } from '../store/appStore';
import { palette, radius, spacing, typography } from '../theme';
import { Button, Card, EmptyState, SectionTitle } from '../components/ui';
import { ProductCard } from '../components/ProductCard';
import { buildCartItem } from '../store/cart';
import { api } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'Restaurant'>;

export function RestaurantScreen({ navigation }: Props) {
  const { restaurant, tables, tableId, setTable, menu, addToCart } = useApp();

  if (!restaurant || !menu) {
    return <EmptyState title="Loading restaurant…" />;
  }

  const color = restaurant.branding.primaryColor;
  const featured = [...menu.products]
    .filter((p) => p.available)
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 3);

  function quickAdd(productId: string) {
    const product = menu!.products.find((p) => p.id === productId);
    if (!product) return;
    // Auto-satisfy required groups with their first option for a 1-tap add.
    const required = product.modifierGroups
      .filter((g) => g.minSelect > 0)
      .map((g) => g.modifiers.find((m) => m.available)?.id)
      .filter(Boolean) as string[];
    addToCart(buildCartItem(product, { quantity: 1, sizeId: null, modifierIds: required }));
    api.track({ restaurantId: restaurant!.id, name: 'product_added', properties: { productId, source: 'featured' } });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <View style={[styles.hero, { borderColor: color }]}>
        <View style={[styles.logo, { backgroundColor: color }]}>
          <Text style={styles.logoText}>{restaurant.name.slice(0, 1)}</Text>
        </View>
        <Text style={typography.h1}>{restaurant.name}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: palette.success }]} />
          <Text style={typography.muted}>Open now</Text>
        </View>
        <Text style={[typography.body, { marginTop: spacing.sm }]}>{restaurant.branding.welcomeMessage}</Text>
      </View>

      <SectionTitle>Your table</SectionTitle>
      <View style={styles.tables}>
        {tables.map((t) => {
          const active = tableId === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTable(active ? null : t.id)}
              style={[styles.tableChip, active && { backgroundColor: color, borderColor: color }]}
            >
              <Text style={[styles.tableChipText, active && { color: palette.primaryText }]}>{t.number}</Text>
            </Pressable>
          );
        })}
      </View>
      {tableId ? (
        <Text style={[typography.muted, { marginBottom: spacing.lg }]}>
          Table {tables.find((t) => t.id === tableId)?.number} selected
        </Text>
      ) : (
        <Text style={[typography.muted, { marginBottom: spacing.lg }]}>Select your table number</Text>
      )}

      <SectionTitle>Featured</SectionTitle>
      {featured.map((p) => (
        <View key={p.id} style={{ marginBottom: spacing.md }}>
          <ProductCard
            product={p}
            color={color}
            onAdd={() => quickAdd(p.id)}
            onPress={() => navigation.navigate('Product', { productId: p.id })}
          />
        </View>
      ))}

      <Card style={{ marginTop: spacing.md }}>
        <Button title="How can I help you today? →" color={color} onPress={() => navigation.navigate('Main')} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  hero: {
    alignItems: 'center',
    padding: spacing.xl,
    borderWidth: 1,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    marginBottom: spacing.xl,
  },
  logo: { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  logoText: { color: palette.primaryText, fontSize: 30, fontWeight: '900' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tables: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  tableChip: {
    minWidth: 46,
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableChipText: { color: palette.text, fontWeight: '800', fontSize: 15 },
});
