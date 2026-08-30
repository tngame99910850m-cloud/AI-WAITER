import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../store/appStore';
import { api, ApiError } from '../api/client';
import type { ServiceRequestType } from '../types';
import { palette, radius, spacing, typography } from '../theme';
import { Card, EmptyState } from '../components/ui';

const ACTIONS: { type: ServiceRequestType; label: string; emoji: string }[] = [
  { type: 'call_waiter', label: 'Call Waiter', emoji: '🙋' },
  { type: 'request_water', label: 'Request Water', emoji: '💧' },
  { type: 'request_bill', label: 'Request Bill', emoji: '🧾' },
  { type: 'request_assistance', label: 'Request Assistance', emoji: '🆘' },
  { type: 'request_napkins', label: 'Request Napkins', emoji: '🧻' },
];

export function ServiceScreen() {
  const { restaurant, tableId, tables } = useApp();
  const [sentType, setSentType] = useState<ServiceRequestType | null>(null);
  const [busyType, setBusyType] = useState<ServiceRequestType | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!restaurant) return <EmptyState title="Not connected" />;
  const color = restaurant.branding.primaryColor;
  const tableNumber = tables.find((t) => t.id === tableId)?.number;

  async function send(type: ServiceRequestType) {
    setBusyType(type);
    setError(null);
    try {
      await api.createServiceRequest({ restaurantId: restaurant!.id, tableId, type });
      api.track({ restaurantId: restaurant!.id, name: 'service_request_created', properties: { type } });
      setSentType(type);
      setTimeout(() => setSentType((cur) => (cur === type ? null : cur)), 3000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send request. Please try again.');
    } finally {
      setBusyType(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={typography.h2}>Table Service</Text>
      <Text style={[typography.muted, { marginTop: 4, marginBottom: spacing.lg }]}>
        {tableNumber ? `Table ${tableNumber} · ` : ''}Tap to send a request to the restaurant.
      </Text>

      {ACTIONS.map((a) => {
        const sent = sentType === a.type;
        const busy = busyType === a.type;
        return (
          <Card
            key={a.type}
            onPress={() => (busy ? undefined : send(a.type))}
            style={[styles.action, sent && { borderColor: palette.success }]}
          >
            <Text style={{ fontSize: 26 }}>{a.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>{a.label}</Text>
              {sent ? (
                <Text style={{ color: palette.success, fontWeight: '700', marginTop: 2 }}>
                  ✓ Your request has been sent to the restaurant.
                </Text>
              ) : busy ? (
                <Text style={typography.muted}>Sending…</Text>
              ) : null}
            </View>
          </Card>
        );
      })}

      {error ? (
        <Card style={{ marginTop: spacing.md, borderColor: palette.danger }}>
          <Text style={{ color: palette.danger }}>{error}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.md },
});
