import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useApp } from '../store/appStore';
import { formatMoney, palette, radius, spacing, typography } from '../theme';
import { Button, EmptyState, Tag } from '../components/ui';
import { QuantityStepper } from '../components/QuantityStepper';
import { buildCartItem, validateSelection } from '../store/cart';
import { api } from '../api/client';
import type { ModifierGroup } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Product'>;

export function ProductScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { menu, restaurant, addToCart } = useApp();
  const product = menu?.products.find((p) => p.id === route.params.productId);
  const color = restaurant?.branding.primaryColor ?? palette.primary;

  const [sizeId, setSizeId] = useState<string | null>(product?.sizes[0]?.id ?? null);
  const [selected, setSelected] = useState<string[]>(() =>
    (product?.modifierGroups ?? [])
      .filter((g) => g.minSelect > 0)
      .map((g) => g.modifiers.find((m) => m.available)?.id)
      .filter(Boolean) as string[],
  );
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const preview = useMemo(() => {
    if (!product) return null;
    return buildCartItem(product, { quantity, sizeId, modifierIds: selected, notes });
  }, [product, quantity, sizeId, selected, notes]);

  if (!product) return <EmptyState title="Product unavailable" />;

  function toggleModifier(group: ModifierGroup, modifierId: string) {
    setSelected((prev) => {
      const inGroup = group.modifiers.map((m) => m.id);
      const currentInGroup = prev.filter((id) => inGroup.includes(id));
      const isSelected = prev.includes(modifierId);
      if (isSelected) return prev.filter((id) => id !== modifierId);
      // Single-select group: replace.
      if (group.maxSelect === 1) return [...prev.filter((id) => !inGroup.includes(id)), modifierId];
      if (group.maxSelect != null && currentInGroup.length >= group.maxSelect) return prev;
      return [...prev, modifierId];
    });
  }

  function add() {
    const check = validateSelection(product!, selected);
    if (!check.ok) return; // Button is disabled; guard anyway.
    addToCart(buildCartItem(product!, { quantity, sizeId, modifierIds: selected, notes }));
    api.track({ restaurantId: restaurant!.id, name: 'product_added', properties: { productId: product!.id, source: 'detail' } });
    navigation.goBack();
  }

  const valid = validateSelection(product, selected);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Text style={{ fontSize: 52 }}>🍽️</Text>
        </View>
        <Text style={typography.h1}>{product.name}</Text>
        {product.description ? <Text style={[typography.muted, { marginTop: 4 }]}>{product.description}</Text> : null}
        <View style={styles.tags}>
          {product.dietaryTags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </View>

        {product.sizes.length > 0 ? (
          <Group title="Size" required>
            {product.sizes.map((s) => (
              <Option
                key={s.id}
                label={s.name}
                price={s.priceDelta.amount}
                currency={product.basePrice.currency}
                selected={sizeId === s.id}
                color={color}
                onPress={() => setSizeId(s.id)}
              />
            ))}
          </Group>
        ) : null}

        {product.modifierGroups.map((g) => (
          <Group
            key={g.id}
            title={g.name}
            required={g.minSelect > 0}
            hint={g.maxSelect === 1 ? 'Choose one' : g.maxSelect ? `Up to ${g.maxSelect}` : undefined}
          >
            {g.modifiers.map((m) => (
              <Option
                key={m.id}
                label={m.name}
                price={m.priceDelta.amount}
                currency={product.basePrice.currency}
                selected={selected.includes(m.id)}
                disabled={!m.available}
                color={color}
                onPress={() => toggleModifier(g, m.id)}
              />
            ))}
          </Group>
        ))}

        <Text style={[typography.h3, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>Special requests</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. extra crispy, sauce on the side"
          placeholderTextColor={palette.textMuted}
          style={styles.notes}
          multiline
        />

        <View style={styles.qtyRow}>
          <Text style={typography.h3}>Quantity</Text>
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.lg }]}>
        {!valid.ok ? <Text style={styles.warn}>{valid.message}</Text> : null}
        <Button
          title={preview ? `Add to Order · ${formatMoney(preview.lineTotal)}` : 'Add to Order'}
          color={color}
          disabled={!valid.ok}
          onPress={add}
        />
      </View>
    </View>
  );
}

function Group({ title, required, hint, children }: { title: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={styles.groupHead}>
        <Text style={typography.h3}>{title}</Text>
        {required ? <Text style={styles.required}>Required</Text> : hint ? <Text style={typography.muted}>{hint}</Text> : null}
      </View>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

function Option({
  label,
  price,
  currency,
  selected,
  disabled,
  color,
  onPress,
}: {
  label: string;
  price: number;
  currency: string;
  selected: boolean;
  disabled?: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.option, selected && { borderColor: color, backgroundColor: palette.surfaceAlt }, disabled && { opacity: 0.4 }]}
    >
      <View style={[styles.radio, selected && { borderColor: color, backgroundColor: color }]} />
      <Text style={[typography.body, { flex: 1 }]}>{label}{disabled ? ' (sold out)' : ''}</Text>
      {price !== 0 ? <Text style={typography.muted}>+{formatMoney({ amount: price, currency })}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  hero: { height: 160, borderRadius: radius.lg, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  tags: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, flexWrap: 'wrap' },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  required: { color: palette.warning, fontWeight: '700', fontSize: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: palette.border },
  notes: {
    minHeight: 60,
    color: palette.text,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface },
  warn: { color: palette.warning, marginBottom: spacing.sm, textAlign: 'center' },
});
