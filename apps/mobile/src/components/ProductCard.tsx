import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Product } from '../types';
import { palette, radius, spacing, typography } from '../theme';
import { formatMoney } from '../theme';
import { Button, Card, Stars, Tag } from './ui';

const toneFor = (tag: string): 'spicy' | 'healthy' | 'popular' | 'default' =>
  tag === 'spicy' ? 'spicy' : tag === 'healthy' ? 'healthy' : tag === 'popular' ? 'popular' : 'default';

export function ProductCard({
  product,
  onAdd,
  onPress,
  ctaLabel = 'Add to Order',
  color,
}: {
  product: Product;
  onAdd: () => void;
  onPress?: () => void;
  ctaLabel?: string;
  color?: string;
}) {
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.imageWrap}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imageEmoji}>🍽️</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={typography.h3} numberOfLines={1}>
          {product.name}
        </Text>
        {product.description ? (
          <Text style={[typography.muted, { marginTop: 2 }]} numberOfLines={2}>
            {product.description}
          </Text>
        ) : null}
        <View style={styles.tags}>
          {product.dietaryTags.slice(0, 3).map((t) => (
            <Tag key={t} label={t} tone={toneFor(t)} />
          ))}
        </View>
        <View style={styles.footer}>
          <View>
            <Text style={typography.price}>{formatMoney(product.basePrice)}</Text>
            <Stars rating={product.rating} />
          </View>
          <Button title={ctaLabel} onPress={onAdd} color={color} style={styles.cta} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  imageWrap: { width: '100%', height: 150, backgroundColor: palette.surfaceAlt },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imageEmoji: { fontSize: 44 },
  body: { padding: spacing.lg },
  tags: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  footer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cta: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
});
