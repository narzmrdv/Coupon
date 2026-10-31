import React from 'react';
import { TextInput, View, Text, TextInputProps, StyleSheet } from 'react-native';
import { wp, hp, fontSize } from '../../lib/responsive';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = ({ label, error, style, ...props }: InputProps) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error ? styles.inputError : styles.inputNormal, style]}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: hp(18),
  },
  label: {
    color: '#1E293B',
    marginBottom: hp(8),
    fontWeight: '600',
    fontSize: fontSize(14),
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderRadius: wp(14),
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
    fontSize: fontSize(16),
    color: '#1E293B',
  },
  inputNormal: {
    borderColor: '#E0F2FE',
  },
  inputError: {
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#EF4444',
    fontSize: fontSize(13),
    marginTop: hp(6),
    fontWeight: '500',
  },
});
