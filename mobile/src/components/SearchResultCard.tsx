import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { cleanDefinition } from '../utils/text';

export interface SearchResult {
  id: number | string;
  simplified: string;
  traditional?: string | null;
  pinyin: string;
  definition: string;
  hsk_level?: number;
}

interface SearchResultCardProps {
  result: SearchResult;
  onPress: () => void;
  index?: number;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({ result, onPress }) => {
  const cleaned = cleanDefinition(result.definition) || result.definition || 'No definition available';
  const hasHsk = result.hsk_level != null && result.hsk_level > 0;
  const simplified = result.simplified || '';
  const charCount = simplified.length || 1;
  const fontSize = charCount >= 4 ? 22 : charCount === 3 ? 26 : 32;
  const lineHeight = charCount >= 4 ? 28 : charCount === 3 ? 32 : 38;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
    >
      {/* Left Column: Hanzi + Pinyin + HSK Badge */}
      <View style={styles.charStack}>
        <View style={styles.hanziRow}>
          {simplified.split('').map((char, i) => (
            <Text key={i} style={[styles.characterText, { fontSize, lineHeight }]}>
              {char}
            </Text>
          ))}
        </View>
        <Text style={styles.pinyinText}>{result.pinyin}</Text>
        {hasHsk && (
          <View style={styles.hskBadge}>
            <Text style={styles.hskBadgeText}>HSK {result.hsk_level}</Text>
          </View>
        )}
      </View>

      {/* Right Column: Clean Definition */}
      <View style={styles.defContainer}>
        <Text style={styles.definitionText} numberOfLines={2}>
          {cleaned}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(42, 47, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(58, 65, 58, 0.5)',
    borderRadius: 16,
    marginBottom: 10,
    minWidth: 0,
    width: '100%',
  },
  charStack: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    flexShrink: 0,
  },
  hanziRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  characterText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f0fdf4',
    textAlign: 'center',
    lineHeight: 38,
    fontFamily: Platform.select({
      web: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif',
      default: undefined,
    }),
  },
  pinyinText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4ade80',
    marginTop: 2,
    textAlign: 'center',
  },
  hskBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginTop: 3,
    alignSelf: 'center',
  },
  hskBadgeText: {
    color: '#4ade80',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  defContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  definitionText: {
    fontSize: 16,
    color: '#f0fdf4',
    lineHeight: 22,
    fontWeight: '400',
  },
});
