import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useApp } from '../store/appStore';
import { api } from '../api/client';
import type { Order, OrderStatus } from '../types';
import { formatMoney, palette, radius, spacing, typography } from '../theme';
import { Button, Card, EmptyState } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderStatus'>;

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'received', label: 'Order Received' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'served', label: 'Served' },
];

export function OrderStatusScreen({ route, navigation }: Props) {
  const { restaurant } = useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurant) return;
    let alive = true;
    const load = () =>
      api
        .getOrder(restaurant.id, route.params.orderId)
        .then((o) => alive && setOrder(o))
        .catch((e) => alive && setError(e.message));
    load();
    // Poll for status changes (replace with websocket/SSE in production).
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [restaurant?.id, route.params.orderId]);

  if (error) return <EmptyState title="Couldn’t load order" subtitle={error} />;
  if (!order) return <EmptyState title="Loading order…" />;

  const activeIndex = STEPS.findIndex((s) => s.key === order.status);
  const cancelled = order.status === 'cancelled';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Text style={typography.muted}>Order</Text>
        <Text style={typography.h1}>#{order.displayNumber}</Text>

        {cancelled ? (
          <Text style={{ color: palette.danger, fontWeight: '800', marginTop: spacing.md }}>This order was cancelled.</Text>
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            {STEPS.map((step, i) => {
              const done = i < activeIndex;
              const current = i === activeIndex;
              return (
                <View key={step.key} style={styles.step}>
                  <View
                    style={[
                      styles.bullet,
                      done && { backgroundColor: palette.success, borderColor: palette.success },
                      current && { borderColor: palette.success },
                    ]}
                  >
                    {done ? <Text style={styles.check}>✓</Text> : current ? <View style={styles.pulse} /> : null}
                  </View>
                  <Text style={[typography.body, (done || current) && { fontWeight: '800' }, !done && !current && { color: palette.textMuted }]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        {order.items.map((i) => (
          <View key={i.lineId} style={styles.line}>
            <Text style={[typography.body, { flex: 1 }]}>{i.name} × {i.quantity}</Text>
            <Text style={typography.price}>{formatMoney(i.lineTotal)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.line}>
          <Text style={[typography.body, { fontWeight: '900' }]}>Total</Text>
          <Text style={[typography.price, { fontSize: 17 }]}>{formatMoney(order.totals.total)}</Text>
        </View>
      </Card>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Button title="Order more" variant="secondary" onPress={() => navigation.navigate('Main')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  bullet: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  check: { color: '#fff', fontWeight: '900', fontSize: 14 },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.success },
  line: { flexDirection: 'row', gap: spacing.md, paddingVertical: 6 },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
});
