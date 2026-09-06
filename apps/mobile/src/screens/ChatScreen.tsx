import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store/appStore';
import { api, ApiError } from '../api/client';
import type { ChatMessage, ChatResult, Product } from '../types';
import { palette, radius, spacing, typography } from '../theme';
import { Button, Card } from '../components/ui';
import { ChatBubble, TypingBubble } from '../components/ChatBubble';
import { ProductCard } from '../components/ProductCard';
import { buildCartItem } from '../store/cart';
import { StickyCartBar } from '../components/StickyCartBar';

interface Entry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recommended?: Product[];
  upsell?: ChatResult['upsell'];
}

const QUICK = ['What do you recommend?', 'What is spicy?', "What's good for kids?", 'Something under 30 QAR'];

export function ChatScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { restaurant, menu, tableId, cart, addToCart, removeByProduct, clearCart, cartProductIds } = useApp();
  const color = restaurant?.branding.primaryColor ?? palette.primary;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (restaurant) {
      setEntries([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hi! I’m ${restaurant.branding.aiWaiterName}. I can recommend dishes, answer menu questions, and take your order. What are you in the mood for?`,
        },
      ]);
      api.track({ restaurantId: restaurant.id, name: 'ai_chat_started' });
    }
  }, [restaurant?.id]);

  function productsByIds(ids: string[]): Product[] {
    if (!menu) return [];
    return ids.map((id) => menu.products.find((p) => p.id === id)).filter(Boolean) as Product[];
  }

  async function send(text: string) {
    if (!restaurant || !menu || !text.trim() || sending) return;
    const history: ChatMessage[] = entries
      .filter((e) => e.id !== 'welcome')
      .slice(-12)
      .map((e) => ({ role: e.role, content: e.content }));

    const userEntry: Entry = { id: `u_${Date.now()}`, role: 'user', content: text.trim() };
    setEntries((prev) => [...prev, userEntry]);
    setInput('');
    setSending(true);

    try {
      const result = await api.chat({
        restaurantId: restaurant.id,
        tableId,
        message: text.trim(),
        history,
        cartProductIds: cartProductIds(),
      });
      applyResult(result);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      setEntries((prev) => [...prev, { id: `err_${Date.now()}`, role: 'assistant', content: msg }]);
    } finally {
      setSending(false);
    }
  }

  function applyResult(result: ChatResult) {
    // Apply resolved items to the cart.
    for (const item of result.resolvedItems) {
      addToCart(item);
      api.track({ restaurantId: restaurant!.id, name: 'product_added', properties: { productId: item.productId, source: 'ai' } });
    }
    for (const op of result.cartOps) {
      if (op.op === 'clear') clearCart();
      else if (op.op === 'remove' && op.productId) removeByProduct(op.productId);
    }
    if (result.upsell) {
      api.track({ restaurantId: restaurant!.id, name: 'upsell_shown' });
    }

    setEntries((prev) => [
      ...prev,
      {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        recommended: productsByIds(result.recommendedProductIds),
        upsell: result.upsell,
      },
    ]);

    if (result.requiresConfirmation) {
      if (cart.length === 0 && result.resolvedItems.length === 0) {
        // Nothing to confirm yet.
      } else {
        setTimeout(() => navigation.navigate('Cart'), 350);
      }
    }
  }

  function acceptUpsell(entry: Entry) {
    if (!entry.upsell || !menu || !restaurant) return;
    api.track({ restaurantId: restaurant.id, name: 'upsell_accepted' });
    if (entry.upsell.productId) {
      const product = menu.products.find((p) => p.id === entry.upsell!.productId);
      if (product) addToCart(buildCartItem(product, { quantity: 1, sizeId: null, modifierIds: [] }));
    } else {
      // Modifier upsell (e.g. cheese sauce): add to the most recent matching line.
      send('yes please, add that');
      return;
    }
    setEntries((prev) => [...prev, { id: `up_${Date.now()}`, role: 'assistant', content: 'Added — nice choice!' }]);
  }

  function onVoice() {
    Alert.alert(
      'Voice ordering',
      'Voice capture runs in a native dev build (expo-speech-recognition). For now, type your request — e.g. “a spicy chicken sandwich, no onions, add cheese, make it a meal”.',
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: spacing.lg }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {entries.map((e) => (
            <View key={e.id}>
              <ChatBubble role={e.role} color={color}>
                {e.content}
              </ChatBubble>
              {e.recommended && e.recommended.length > 0 ? (
                <View style={styles.recs}>
                  {e.recommended.map((p) => (
                    <View key={p.id} style={{ marginBottom: spacing.md }}>
                      <ProductCard
                        product={p}
                        color={color}
                        onAdd={() => {
                          const required = p.modifierGroups
                            .filter((g) => g.minSelect > 0)
                            .map((g) => g.modifiers.find((m) => m.available)?.id)
                            .filter(Boolean) as string[];
                          addToCart(buildCartItem(p, { quantity: 1, sizeId: null, modifierIds: required }));
                          api.track({ restaurantId: restaurant!.id, name: 'recommendation_clicked', properties: { productId: p.id } });
                        }}
                        onPress={() => navigation.navigate('Product', { productId: p.id })}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
              {e.upsell ? (
                <View style={styles.recs}>
                  <Card style={{ borderColor: color }}>
                    <Text style={[typography.body, { marginBottom: spacing.md }]}>{e.upsell.message}</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <Button title="Yes please" color={color} style={{ flex: 1 }} onPress={() => acceptUpsell(e)} />
                      <Button
                        title="No thanks"
                        variant="ghost"
                        style={{ flex: 1 }}
                        onPress={() => api.track({ restaurantId: restaurant!.id, name: 'upsell_rejected' })}
                      />
                    </View>
                  </Card>
                </View>
              ) : null}
            </View>
          ))}
          {sending ? <TypingBubble /> : null}
        </ScrollView>

        {entries.length <= 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {QUICK.map((q) => (
              <Pressable key={q} style={styles.quickChip} onPress={() => send(q)}>
                <Text style={styles.quickText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={[styles.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md }]}>
          <Pressable onPress={onVoice} style={styles.mic} accessibilityLabel="Talk to AI Waiter">
            <Text style={{ fontSize: 20 }}>🎤</Text>
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask the AI waiter…"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, { backgroundColor: color, opacity: !input.trim() || sending ? 0.5 : 1 }]}
          >
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <StickyCartBar onPress={() => navigation.navigate('Cart')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  recs: { paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.sm },
  quickRow: { maxHeight: 48, marginBottom: spacing.sm },
  quickChip: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  quickText: { color: palette.text, fontSize: 13 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  mic: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.surfaceAlt },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    color: palette.text,
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    fontSize: 15,
  },
  sendBtn: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: palette.primaryText, fontSize: 18, fontWeight: '900' },
});
