import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store/appStore';
import { api, ApiError } from '../api/client';
import { formatMoney, palette, radius, spacing, typography } from '../theme';
import { Button, Card, EmptyState } from '../components/ui';

function makeKey() {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function ConfirmationScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { cart, restaurant, tableId, tables, totals, clearCart, setLastOrderId } = useApp();
  const color = restaurant?.branding.primaryColor ?? palette.primary;
  const t = totals();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A single idempotency key for this confirmation — a double-tap can't create
  // two orders because the server dedupes on this key.
  const idempotencyKey = useRef(makeKey()).current;

  if (!restaurant || cart.length === 0) {
    return <EmptyState title="Nothing to confirm" subtitle="Your order is empty." />;
  }

  const tableNumber = tables.find((tab) => tab.id === tableId)?.number;

  async function confirm() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { order } = await api.createOrder(
        {
          restaurantId: restaurant!.id,
          tableId,
          items: cart.map((i) => ({
            lineId: i.lineId,
            productId: i.productId,
            quantity: i.quantity,
            sizeId: i.sizeId,
            modifierIds: i.modifiers.map((m) => m.modifierId),
            notes: i.notes,
          })),
        },
        idempotencyKey,
      );
      api.track({ restaurantId: restaurant!.id, name: 'order_confirmed', properties: { orderId: order.id, total: order.totals.total.amount } });
      setLastOrderId(order.id);
      clearCart();
      navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'OrderStatus', params: { orderId: order.id } }] });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'We couldn’t send your order. Please try again.';
      setError(msg);
      api.track({ restaurantId: restaurant!.id, name: 'order_failed', properties: { reason: msg } });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Text style={typography.h2}>Order Summary</Text>
        {tableNumber ? <Text style={[typography.muted, { marginTop: 4 }]}>Table {tableNumber}</Text> : null}

        <Card style={{ marginTop: spacing.lg }}>
          {cart.map((item) => (
            <View key={item.lineId} style={styles.line}>
              <Text style={[typography.body, { flex: 1 }]}>
                {item.name} × {item.quantity}
                {item.sizeName ? `  ·  ${item.sizeName}` : ''}
                {item.modifiers.length ? `\n${item.modifiers.map((m) => m.name).join(', ')}` : ''}
              </Text>
              <Text style={typography.price}>{formatMoney(item.lineTotal)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <Row label="Subtotal" value={formatMoney(t.subtotal)} />
          <Row label="Tax" value={formatMoney(t.tax)} />
          <Row label="Total" value={formatMoney(t.total)} bold />
        </Card>

        {error ? (
          <Card style={{ marginTop: spacing.lg, borderColor: palette.danger }}>
            <Text style={{ color: palette.danger, fontWeight: '700' }}>{error}</Text>
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.lg }]}>
        <Button title={error ? 'Try Again' : 'CONFIRM ORDER'} color={color} loading={submitting} onPress={confirm} />
      </View>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[typography.body, bold && { fontWeight: '800', fontSize: 17 }]}>{label}</Text>
      <Text style={[typography.body, bold ? { fontWeight: '900', fontSize: 17 } : { fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  line: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface },
});
