import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius } from '../theme';

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel="Decrease quantity"
        onPress={() => onChange(Math.max(min, value - 1))}
        style={styles.btn}
      >
        <Text style={styles.sign}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        accessibilityLabel="Increase quantity"
        onPress={() => onChange(Math.min(max, value + 1))}
        style={styles.btn}
      >
        <Text style={styles.sign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
  },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sign: { color: palette.text, fontSize: 22, fontWeight: '700' },
  value: { color: palette.text, fontSize: 16, fontWeight: '800', minWidth: 24, textAlign: 'center' },
});
