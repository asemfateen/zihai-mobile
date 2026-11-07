import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { playTtsAudio } from '../utils/audio';
import { cleanDefinition } from '../utils/text';
import { getWordDetails, WordDetailData } from '../services/dictionaryService';
import { SpeakerIcon, ChevronLeftIcon, XIcon } from './Icons';

interface WordDetailModalProps {
  visible: boolean;
  word: {
    simplified: string;
    traditional?: string | null;
    pinyin: string;
    definition: string;
    hsk_level?: number;
  } | null;
  onClose: () => void;
  onSelectSubWord?: (char: string) => void;
}

function getToneColor(pinyin: string): string {
  if (!pinyin) return 'rgba(74, 222, 128, 0.15)';
  if (/[āēīōūǖ]/i.test(pinyin)) return 'rgba(239, 68, 68, 0.2)'; // 1st tone red
  if (/[áéíóúǘ]/i.test(pinyin)) return 'rgba(168, 85, 247, 0.2)'; // 2nd tone green
  if (/[ǎěǐǒǔǚ]/i.test(pinyin)) return 'rgba(59, 130, 246, 0.2)'; // 3rd tone blue
  if (/[àèìòùǜ]/i.test(pinyin)) return 'rgba(16, 185, 129, 0.2)'; // 4th tone purple
  return 'rgba(74, 222, 128, 0.15)';
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  visible,
  word,
  onClose,
  onSelectSubWord,
}) => {
  const db = useSQLiteContext();
  const [details, setDetails] = useState<WordDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [history, setHistory] = useState<WordDetailData[]>([]);
  const [prevTarget, setPrevTarget] = useState<string | null>(null);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  const currentTarget = visible && word ? word.simplified : null;
  if (currentTarget !== prevTarget) {
    setPrevTarget(currentTarget);
    setDetails(null);
    setHistory([]);
  }

  useEffect(() => {
    let isCancelled = false;

    if (visible && word) {
      getWordDetails(db, word.simplified)
        .then((data) => {
          if (!isCancelled && data) {
            setDetails(data);
          }
        })
        .catch((err) => {
          if (__DEV__) {
            console.error('[Zihai Details] Failed to load word details:', err);
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [visible, word, db]);

  if (!word) return null;

  const handleSubWordPress = async (char: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    setLoading(true);
    try {
      const data = await getWordDetails(db, char);
      if (data) {
        if (details) {
          setHistory((prev) => [...prev, details]);
        }
        setDetails(data);
      }
    } catch (err) {
      if (__DEV__) {
        console.error('[Zihai Details] Failed to drill down:', err);
      }
    } finally {
      setLoading(false);
    }
    if (onSelectSubWord) {
      onSelectSubWord(char);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    if (history.length > 0) {
      const prevData = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      setDetails(prevData);
    } else {
      setDetails(null);
      setHistory([]);
      onClose();
    }
  };

  const handlePlaySound = (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSpeaking(true);
    playTtsAudio(text, {
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const activeDetails = history.length === 0 && details?.character !== word.simplified ? null : details;

  const currentDetails: WordDetailData = activeDetails || {
    character: word.simplified,
    traditional: word.traditional || undefined,
    pinyin: word.pinyin,
    english_definition: cleanDefinition(word.definition) || word.definition,
    hsk_level: word.hsk_level,
    definitions: (word.definition || '')
      .split(/;\s*|\/\s*/)
      .map(cleanDefinition)
      .filter(Boolean),
  };

  const hskLevel = currentDetails.hsk_level ?? word.hsk_level ?? 0;
  const isTraditionalDifferent =
    currentDetails.traditional && currentDetails.traditional !== currentDetails.character;
  const toneGlowColor = getToneColor(currentDetails.pinyin);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent={true}
      onRequestClose={handleBack}
    >
      <StatusBar style="light" />
      <SafeAreaView style={styles.modalRoot} edges={['top', 'left', 'right']}>
        {/* Top Header: Optional Back on Left, Close on Right */}
        <View style={styles.topBar}>
          {history.length > 0 ? (
            <TouchableOpacity
              style={styles.historyBackButton}
              onPress={handleBack}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeftIcon size={16} color="#4ade80" />
              <Text style={styles.historyBackButtonText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDetails(null);
              setHistory([]);
              onClose();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <XIcon size={16} color="#bbf7d0" />
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.innerContainer}>
            {/* HERO BENTO CARD */}
            <View style={styles.heroCard}>

              {/* Large Characters */}
              <View style={styles.charRow}>
                {(currentDetails.character || '').split('').map((char, i) => (
                  <Text key={i} style={styles.heroChar}>
                    {char}
                  </Text>
                ))}
              </View>

              {isTraditionalDifferent && (
                <View style={styles.traditionalBadge}>
                  <Text style={styles.traditionalText}>
                    Traditional: {currentDetails.traditional}
                  </Text>
                </View>
              )}

              {/* Pinyin & Audio Button */}
              <View style={styles.pinyinSpeakerRow}>
                <Text style={styles.heroPinyin}>{currentDetails.pinyin}</Text>
                <TouchableOpacity
                  style={[styles.speakerCircle, isSpeaking && styles.speakerCircleActive]}
                  onPress={() => handlePlaySound(currentDetails.character)}
                  activeOpacity={0.7}
                >
                  <SpeakerIcon size={20} color={isSpeaking ? '#1a1c1a' : '#4ade80'} />
                </TouchableOpacity>
              </View>

              {/* Badges (Type, HSK, Strokes, Radical) */}
              <View style={styles.badgeRow}>
                {currentDetails.character.length > 1 ? (
                  <View style={styles.wordTypePill}>
                    <Text style={styles.wordTypePillText}>
                      Compound Word · {currentDetails.character.length} Chars
                    </Text>
                  </View>
                ) : (
                  <View style={styles.wordTypePill}>
                    <Text style={styles.wordTypePillText}>Single Character</Text>
                  </View>
                )}

                {hskLevel > 0 && (
                  <View style={styles.hskPill}>
                    <Text style={styles.hskPillText}>HSK {hskLevel}</Text>
                  </View>
                )}

                {currentDetails.stroke_count != null && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{currentDetails.stroke_count} strokes</Text>
                  </View>
                )}

                {currentDetails.radical != null && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>
                      Radical #{currentDetails.radical}{' '}
                      {currentDetails.radical_char
                        ? `(${currentDetails.radical_char} ${currentDetails.radical_name || ''})`
                        : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4ade80" />
                <Text style={styles.loadingMessage}>Loading character details...</Text>
              </View>
            )}

            {/* DEFINITIONS BENTO CARD */}
            <View style={styles.bentoCard}>
              <Text style={styles.cardHeaderTitle}>Definitions</Text>
              {(() => {
                const visibleDefs = (currentDetails.definitions || [])
                  .map(cleanDefinition)
                  .filter(Boolean);

                if (visibleDefs.length > 0) {
                  return visibleDefs.map((cleanedItem, idx) => (
                    <View key={idx} style={styles.definitionItem}>
                      <View style={styles.defBadge}>
                        <Text style={styles.defBadgeText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.definitionBody}>{cleanedItem}</Text>
                    </View>
                  ));
                }

                const fallback =
                  cleanDefinition(currentDetails.english_definition || '') ||
                  'No definition available.';
                return (
                  <View style={styles.definitionItem}>
                    <View style={styles.defBadge}>
                      <Text style={styles.defBadgeText}>1</Text>
                    </View>
                    <Text style={styles.definitionBody}>{fallback}</Text>
                  </View>
                );
              })()}
            </View>

            {/* CHARACTER BREAKDOWN (If multi-char or sub-components) */}
            {currentDetails.components && currentDetails.components.length > 0 && (
              <View style={styles.bentoCard}>
                <Text style={styles.cardHeaderTitle}>Component Breakdown</Text>
                <Text style={styles.cardHeaderSubtitle}>Tap a sub-character to inspect:</Text>
                <View style={styles.componentsGrid}>
                  {currentDetails.components.map((comp, idx) => {
                    const compDefCleaned =
                      cleanDefinition(comp.english_definition || comp.definitions?.[0] || '') ||
                      comp.english_definition ||
                      'Character component';
                    // Extract concise primary meaning so it doesn't get clipped into a semicolon trail
                    const primaryDef = (compDefCleaned.split(';')[0] || compDefCleaned).trim();

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.compCard}
                        activeOpacity={0.7}
                        onPress={() => handleSubWordPress(comp.character)}
                      >
                        <Text style={styles.compChar}>{comp.character}</Text>
                        <Text style={styles.compPinyin}>{comp.pinyin || ''}</Text>
                        {comp.stroke_count != null && (
                          <Text style={styles.compStrokes}>
                            {comp.stroke_count} strokes{comp.radical_char ? ` · 部首 ${comp.radical_char}` : ''}
                          </Text>
                        )}
                        <Text style={styles.compDef} numberOfLines={2}>
                          {primaryDef}
                        </Text>
                        <View style={styles.inspectBadge}>
                          <Text style={styles.inspectBadgeText}>Inspect →</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#1a1c1a',
  },
  topBar: {
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) + 10 : 10,
    paddingBottom: 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(42, 47, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(58, 65, 58, 0.7)',
  },
  closeButtonText: {
    color: '#bbf7d0',
    fontSize: 13,
    fontWeight: '700',
  },
  historyBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(42, 47, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  historyBackButtonText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 48,
    paddingHorizontal: 16,
  },
  innerContainer: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: 16,
  },
  heroCard: {
    backgroundColor: 'rgba(34, 38, 34, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(58, 65, 58, 0.7)',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  heroChar: {
    fontSize: 68,
    fontWeight: '900',
    color: '#f0fdf4',
    textAlign: 'center',
    lineHeight: 78,
  },
  traditionalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(58, 65, 58, 0.6)',
    marginBottom: 8,
  },
  traditionalText: {
    fontSize: 13,
    color: '#86efac',
    fontWeight: '500',
  },
  pinyinSpeakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  heroPinyin: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4ade80',
    letterSpacing: 0.5,
  },
  speakerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerCircleActive: {
    backgroundColor: '#4ade80',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(58, 65, 58, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.25)',
  },
  wordTypePillText: {
    fontSize: 12,
    color: '#86efac',
    fontWeight: '600',
  },
  hskPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  hskPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4ade80',
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(58, 65, 58, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(58, 65, 58, 0.8)',
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#bbf7d0',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 12,
  },
  loadingMessage: {
    color: '#86efac',
    fontSize: 13,
  },
  bentoCard: {
    backgroundColor: 'rgba(42, 47, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(58, 65, 58, 0.5)',
    borderRadius: 20,
    padding: 20,
  },
  cardHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f0fdf4',
    marginBottom: 4,
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: '#86efac',
    marginBottom: 14,
  },
  definitionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  defBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  defBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4ade80',
  },
  definitionBody: {
    fontSize: 15,
    color: '#f0fdf4',
    lineHeight: 22,
    flex: 1,
  },
  componentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  compCard: {
    flex: 1,
    minWidth: 135,
    backgroundColor: 'rgba(42, 47, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(58, 65, 58, 0.7)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  compChar: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f0fdf4',
    marginBottom: 2,
  },
  compPinyin: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4ade80',
    marginBottom: 2,
  },
  compStrokes: {
    fontSize: 11,
    color: '#86efac',
    marginBottom: 6,
  },
  compDef: {
    fontSize: 12,
    color: '#bbf7d0',
    textAlign: 'center',
    lineHeight: 16,
  },
  inspectBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  inspectBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ade80',
  },
});
