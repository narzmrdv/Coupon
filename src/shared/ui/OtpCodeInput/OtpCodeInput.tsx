import React, { forwardRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { wp, fontSize } from '../../lib/responsive';

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
}

export const OtpCodeInput = forwardRef<TextInput, OtpCodeInputProps>(
  ({ value, onChange, onComplete, length = 6, error, autoFocus = true }, ref) => {
    const boxes = Array.from({ length }, (_, i) => value[i] ?? '');

    return (
      <>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.boxesRow}
          onPress={() => {
            if (ref && 'current' in ref) ref.current?.focus();
          }}>
          {boxes.map((digit, i) => (
            <View
              key={i}
              style={[styles.box, digit ? styles.boxFilled : null, error ? styles.boxError : null]}>
              <Text style={styles.boxText}>{digit}</Text>
            </View>
          ))}
        </TouchableOpacity>
        <TextInput
          ref={ref}
          style={styles.hiddenInput}
          value={value}
          onChangeText={(v) => {
            const digitsOnly = v.replace(/\D/g, '').slice(0, length);
            onChange(digitsOnly);
            if (digitsOnly.length === length) onComplete?.(digitsOnly);
          }}
          keyboardType="number-pad"
          maxLength={length}
          autoFocus={autoFocus}
          caretHidden
        />
      </>
    );
  },
);

const styles = StyleSheet.create({
  boxesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  box: {
    width: wp(44),
    height: wp(54),
    borderRadius: wp(12),
    borderWidth: 2,
    borderColor: '#E0F2FE',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: '#0EA5E9', backgroundColor: '#F0F9FF' },
  boxError: { borderColor: '#F87171', backgroundColor: '#FEF2F2' },
  boxText: { fontSize: fontSize(22), fontWeight: '700', color: '#1E293B' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
