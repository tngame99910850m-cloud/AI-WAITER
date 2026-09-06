import React, { useRef, useState } from 'react';
import {
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
import { api, ApiError } from '../api/client';
import type { ChatMessage } from '../types';
import { palette, radius, spacing } from '../theme';
import { ChatBubble, TypingBubble } from '../components/ChatBubble';

interface Entry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const GREETING: Entry = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi! I’m your Claude assistant. Ask me anything about food, dining or using the app.',
};

/**
 * General-purpose Claude chatbot. Talks to the server-side `/api/chat` endpoint,
 * which holds the Anthropic key. Keeps a short conversation history, shows a
 * typing indicator while loading, and surfaces errors as an assistant message.
 */
export function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Entry[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const history: ChatMessage[] = entries
      .filter((e) => e.id !== 'welcome')
      .slice(-12)
      .map((e) => ({ role: e.role, content: e.content }));

    setEntries((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', content: trimmed }]);
    setInput('');
    setSending(true);
    try {
      const reply = await api.assistant({ message: trimmed, history });
      setEntries((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', content: reply }]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      setEntries((prev) => [...prev, { id: `err_${Date.now()}`, role: 'assistant', content: msg }]);
    } finally {
      setSending(false);
    }
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
            <ChatBubble key={e.id} role={e.role} color={palette.primary}>
              {e.content}
            </ChatBubble>
          ))}
          {sending ? <TypingBubble /> : null}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Claude…"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, { opacity: !input.trim() || sending ? 0.5 : 1 }]}
          >
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
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
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  sendText: { color: palette.primaryText, fontSize: 18, fontWeight: '900' },
});
