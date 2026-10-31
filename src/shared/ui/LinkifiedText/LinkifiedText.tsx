import React from 'react';
import { Text, Linking, StyleSheet, TextStyle, StyleProp } from 'react-native';

const URL_REGEX = /(https?:\/\/[^\s]+)/;

interface LinkifiedTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
}

/** Renders `text` with any http(s) URLs as tappable inline links, opened via
 *  `Linking.openURL`. Nested <Text> segments keep the surrounding style
 *  (color, size, line-height) and preserve line breaks from the source text —
 *  no re-splitting on `\n` needed, <Text> renders it natively. */
export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ text, style, linkStyle }) => {
  const parts = text.split(URL_REGEX);

  return (
    <Text style={style}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <Text
            key={index}
            style={[styles.link, linkStyle]}
            onPress={() => void Linking.openURL(part)}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
};

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
    color: '#0EA5E9',
    fontWeight: '600',
  },
});
