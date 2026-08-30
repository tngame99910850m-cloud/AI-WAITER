import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { api } from '../api/client';
import type { RestaurantSummary } from '../types';
import { palette, spacing, typography } from '../theme';
import { Button, Card, EmptyState } from '../components/ui';
import { loadRestaurant } from '../store/actions';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [restaurants, setRestaurants] = useState<RestaurantSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .listRestaurants()
      .then((list) => {
        if (!alive) return;
        setRestaurants(list);
        setSelected(list[0]?.id ?? null);
        if (list[0]) api.track({ restaurantId: list[0].id, name: 'app_opened' });
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  async function proceed() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await loadRestaurant(selected);
      navigation.navigate('Restaurant');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.emoji}>🍽️</Text>
        <Text style={styles.title}>AI Waiter</Text>
        <Text style={styles.subtitle}>Your personal restaurant assistant.</Text>

        {error ? <EmptyState title="Couldn’t connect" subtitle={error} /> : null}

        {restaurants && restaurants.length > 1 ? (
          <View style={styles.restaurants}>
            <Text style={[typography.muted, { marginBottom: spacing.sm }]}>Choose a restaurant</Text>
            {restaurants.map((r) => (
              <Card
                key={r.id}
                onPress={() => setSelected(r.id)}
                style={[styles.restaurantCard, selected === r.id && { borderColor: r.branding.primaryColor }]}
              >
                <Text style={typography.h3}>{r.name}</Text>
                <Text style={typography.muted}>{r.branding.aiWaiterName}</Text>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button title="Start Order" onPress={proceed} loading={busy} disabled={!selected} />
        <Button title="Browse Menu" variant="secondary" onPress={proceed} disabled={!selected} />
        <Button title="Talk to AI Waiter" variant="ghost" onPress={proceed} disabled={!selected} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: spacing.xl },
  content: { alignItems: 'center', paddingVertical: spacing.xxl },
  emoji: { fontSize: 64, marginBottom: spacing.md },
  title: { ...typography.h1, fontSize: 40 },
  subtitle: { ...typography.muted, fontSize: 16, marginTop: spacing.sm, textAlign: 'center' },
  restaurants: { width: '100%', marginTop: spacing.xxl },
  restaurantCard: { marginBottom: spacing.md },
  actions: { gap: spacing.md },
});
