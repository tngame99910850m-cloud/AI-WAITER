import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store/appStore';
import { formatMoney, palette, radius, spacing, typography } from '../theme';
import { Button, Card, EmptyState } from '../components/ui';
import { QuantityStepper } from '../components/QuantityStepper';

export function CartScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { cart, restaurant, tableId, tables, updateQuantity, removeLine, totals } = useApp();
  const color = restaurant?.branding.primaryColor ?? palette.primary;
  const t = totals();

  if (cart.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState title="Your order is empty" subtitle="Ask the AI waiter for a recommendation, or browse the menu." />
        <View style={{ padding: spacing.lg }}>
          <Button title="Browse Menu" variant="secondary" onPress={() => navigation.navigate('Main')} />
        </View>
      </View>
    );
  }

  const tableNumber = tables.find((tab) => tab.id === tableId)?.number;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        {tableNumber ? <Text style={[typography.muted, { marginBottom: spacing.md }]}>Table {tableNumber}</Text> : null}

        {cart.map((item) => (
          <Card key={item.lineId} style={{ marginBottom: spacing.md }}>
            <View style={styles.itemHead}>
              <Text style={[typography.h3, { flex: 1 }]}>{item.name}</Text>
              <Text style={typography.price}>{formatMoney(item.lineTotal)}</Text>
            </View>
            {item.sizeName ? <Text style={typography.muted}>{item.sizeName}</Text> : null}
            {item.modifiers.length > 0 ? (
              <Text style={[typography.muted, { marginTop: 2 }]}>
                {item.modifiers.map((m) => m.name).join(' · ')}
              </Text>
            ) : null}
            {item.notes ? <Text style={[typography.muted, { fontStyle: 'italic', marginTop: 2 }]}>“{item.notes}”</Text> : null}
            <View style={styles.itemFooter}>
              <QuantityStepper value={item.quantity} onChange={(q) => updateQuantity(item.lineId, q)} />
              <Text style={styles.remove} onPress={() => removeLine(item.lineId)}>
                Remove
              </Text>
            </View>
          </Card>
        ))}

        <Card style={{ marginTop: spacing.sm }}>
          <Row label="Subtotal" value={formatMoney(t.subtotal)} />
          {t.discount.amount > 0 ? <Row label="Discount" value={`-${formatMoney(t.discount)}`} /> : null}
          <Row label="Tax" value={formatMoney(t.tax)} />
          <View style={styles.divider} />
          <Row label="Total" value={formatMoney(t.total)} bold />
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.lg }]}>
        <Button title="Continue Ordering" variant="ghost" style={{ flex: 1 }} onPress={() => navigation.navigate('Main')} />
        <Button title="Confirm Order" color={color} style={{ flex: 1 }} onPress={() => navigation.navigate('Confirmation')} />
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
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  remove: { color: palette.danger, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface },
});
