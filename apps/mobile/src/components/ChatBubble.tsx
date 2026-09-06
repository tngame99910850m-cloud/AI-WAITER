import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing } from '../theme';

export function ChatBubble({
  role,
  children,
  color,
}: {
  role: 'user' | 'assistant';
  children: React.ReactNode;
  color?: string;
}) {
  const isUser = role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAi]}>
      <View
        style={[
          styles.bubble,
          isUser ? { backgroundColor: color ?? palette.primary } : styles.aiBubble,
          isUser ? styles.userRadius : styles.aiRadius,
        ]}
      >
        {typeof children === 'string' ? (
          <Text style={[styles.text, isUser && { color: palette.primaryText }]}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export function TypingBubble() {
  return (
    <View style={[styles.row, styles.rowAi]}>
      <View style={[styles.bubble, styles.aiBubble, styles.aiRadius]}>
        <Text style={styles.text}>…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  rowUser: { alignItems: 'flex-end' },
  rowAi: { alignItems: 'flex-start' },
  bubble: { maxWidth: '86%', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  aiBubble: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  userRadius: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg },
  aiRadius: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg },
  text: { color: palette.text, fontSize: 15, lineHeight: 21 },
});
