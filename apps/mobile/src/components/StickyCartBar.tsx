import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../store/appStore';
import { formatMoney, palette, radius, spacing } from '../theme';

/** Floating cart CTA shown above the tab bar when the cart is non-empty. */
export function StickyCartBar({ onPress }: { onPress: () => void }) {
  const count = useApp((s) => s.cartCount());
  const restaurant = useApp((s) => s.restaurant);
  const total = useApp((s) => s.totals().total);
  if (count === 0) return null;
  const color = restaurant?.branding.primaryColor ?? palette.primary;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable onPress={onPress} style={[styles.bar, { backgroundColor: color }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
        <Text style={styles.label}>View Order</Text>
        <Text style={styles.total}>{formatMoney(total)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: spacing.lg, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 54,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  badge: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontWeight: '900' },
  label: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: spacing.md, flex: 1 },
  total: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
