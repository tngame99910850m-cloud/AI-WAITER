import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../store/appStore';
import { palette, radius, spacing, typography } from '../theme';
import { EmptyState } from '../components/ui';
import { ProductCard } from '../components/ProductCard';
import { buildCartItem } from '../store/cart';
import { StickyCartBar } from '../components/StickyCartBar';
import { api } from '../api/client';

export function MenuScreen({ navigation }: any) {
  const { restaurant, menu, addToCart } = useApp();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const color = restaurant?.branding.primaryColor ?? palette.primary;

  const categories = useMemo(
    () => (menu ? [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [menu],
  );

  if (!menu || !restaurant) return <EmptyState title="Menu unavailable" subtitle="Please check your connection." />;

  const products = menu.products.filter((p) => (activeCat ? p.categoryId === activeCat : true));

  function quickAdd(productId: string) {
    const product = menu!.products.find((p) => p.id === productId);
    if (!product) return;
    const required = product.modifierGroups
      .filter((g) => g.minSelect > 0)
      .map((g) => g.modifiers.find((m) => m.available)?.id)
      .filter(Boolean) as string[];
    if (required.length < product.modifierGroups.filter((g) => g.minSelect > 0).length || product.sizes.length > 0) {
      navigation.navigate('Product', { productId });
      return;
    }
    addToCart(buildCartItem(product, { quantity: 1, sizeId: null, modifierIds: required }));
    api.track({ restaurantId: restaurant!.id, name: 'product_added', properties: { productId, source: 'menu' } });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catRow}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      >
        <CatChip label="All" active={activeCat === null} color={color} onPress={() => setActiveCat(null)} />
        {categories.map((c) => (
          <CatChip key={c.id} label={c.name} active={activeCat === c.id} color={color} onPress={() => setActiveCat(c.id)} />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {products.map((p) => (
          <View key={p.id} style={{ marginBottom: spacing.md }}>
            <ProductCard
              product={p}
              color={color}
              ctaLabel={p.modifierGroups.length || p.sizes.length ? 'Customize' : 'Add'}
              onAdd={() => quickAdd(p.id)}
              onPress={() => navigation.navigate('Product', { productId: p.id })}
            />
          </View>
        ))}
      </ScrollView>

      <StickyCartBar onPress={() => navigation.navigate('Cart')} />
    </View>
  );
}

function CatChip({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}>
      <Text style={[styles.chipText, active && { color: palette.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  catRow: { maxHeight: 60, paddingVertical: spacing.md },
  chip: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    justifyContent: 'center',
  },
  chipText: { ...typography.body, fontWeight: '700' },
});
