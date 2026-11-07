import React from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

interface ZihaiLogoProps {
  size?: number;
}

export const ZihaiLogo: React.FC<ZihaiLogoProps> = ({ size = 28 }) => {
  if (Platform.OS === 'web') {
    return (
      <Text
        style={[
          styles.webText,
          {
            fontSize: size,
            backgroundImage: 'linear-gradient(to right, #4ade80, #f43f5e, #f97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          } as any,
        ]}
      >
        字海
      </Text>
    );
  }

  // Native Android and iOS SVG rendering with the exact 3-color gradient
  const width = Math.ceil(size * 2.3);
  const height = Math.ceil(size * 1.35);
  const y = Math.ceil(size * 0.95);

  return (
    <View style={{ width, height, justifyContent: 'center' }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="zihaiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#4ade80" />
            <Stop offset="50%" stopColor="#f43f5e" />
            <Stop offset="100%" stopColor="#f97316" />
          </LinearGradient>
        </Defs>
        <SvgText
          x="1"
          y={y}
          fill="url(#zihaiGrad)"
          fontSize={size}
          fontWeight="900"
          letterSpacing="-1.2"
        >
          字海
        </SvgText>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  webText: {
    fontWeight: '900',
    letterSpacing: -1.2,
    fontFamily: Platform.select({
      web: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      default: undefined,
    }),
  },
});
