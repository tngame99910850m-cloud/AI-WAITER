import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { palette, radius, shadow, spacing, typography } from '../theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  color,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary' ? color ?? palette.primary : variant === 'secondary' ? palette.surfaceAlt : 'transparent';
  const txt = variant === 'primary' ? palette.primaryText : palette.text;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && styles.btnGhost,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={txt} />
      ) : (
        <Text style={[styles.btnText, { color: txt }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export function Tag({ label, tone = 'default' }: { label: string; tone?: 'default' | 'spicy' | 'healthy' | 'popular' }) {
  const bg =
    tone === 'spicy' ? '#7F1D1D' : tone === 'healthy' ? '#14532D' : tone === 'popular' ? '#78350F' : palette.surfaceAlt;
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

export function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  const full = Math.round(rating);
  return (
    <Text style={{ color: palette.star, fontSize: 13 }}>
      {'★'.repeat(full)}
      <Text style={{ color: palette.border }}>{'★'.repeat(Math.max(0, 5 - full))}</Text>
      <Text style={typography.muted}>  {rating.toFixed(1)}</Text>
    </Text>
  );
}

export function Skeleton({ height = 80, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.skeleton, { height }, style]} />;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={[typography.h3, { marginBottom: spacing.sm }]}>{children}</Text>;
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={typography.h3}>{title}</Text>
      {subtitle ? <Text style={[typography.muted, { textAlign: 'center', marginTop: 6 }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  btnGhost: { borderWidth: 1, borderColor: palette.border },
  btnText: { fontSize: 16, fontWeight: '800' },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { color: palette.text, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  skeleton: { backgroundColor: palette.surfaceAlt, borderRadius: radius.md, opacity: 0.6 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
});
