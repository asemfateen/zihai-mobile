import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Keyboard,
  BackHandler,
  useWindowDimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { searchDictionary, SearchResult } from '../services/dictionaryService';
import { SearchResultCard } from '../components/SearchResultCard';
import { WordDetailModal } from '../components/WordDetailModal';
import { SearchIcon, XIcon, ChevronLeftIcon } from '../components/Icons';
import { ZihaiLogo } from '../components/ZihaiLogo';

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const db = useSQLiteContext();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Word Detail Modal
  const [selectedWord, setSelectedWord] = useState<SearchResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Request counter to cancel stale out-of-order responses
  const searchIdRef = useRef(0);

  // Perform search locally via SQLite
  const performSearch = useCallback(
    async (qText: string) => {
      const trimmed = qText.trim();
      if (!trimmed) {
        setResults([]);
        return;
      }

      const currentId = ++searchIdRef.current;
      setLoading(true);

      try {
        const data = await searchDictionary(db, trimmed);
        if (currentId === searchIdRef.current) {
          setResults(data);
        }
      } catch (err) {
        if (__DEV__) {
          console.error('[Zihai Search] Local search failed:', err);
        }
        if (currentId === searchIdRef.current) {
          setResults([]);
        }
      } finally {
        if (currentId === searchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [db]
  );

  // Debounced search when query changes
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const timer = setTimeout(() => {
      performSearch(trimmed);
    }, 180);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Android hardware / gesture back button handling
  useEffect(() => {
    const onBackPress = () => {
      if (modalVisible) {
        // Let WordDetailModal's onRequestClose handle popping sub-words or closing
        return false;
      }
      if (query.length > 0) {
        setQuery('');
        setResults([]);
        Keyboard.dismiss();
        return true;
      }
      return false;
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSubscription.remove();
  }, [modalVisible, query]);

  const handleOpenWord = (item: SearchResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedWord(item);
    setModalVisible(true);
  };

  const handleReset = () => {
    setQuery('');
    setResults([]);
    Keyboard.dismiss();
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.layoutRoot}
      >
        {/* ======================================================== */}
        {/* 1. DESKTOP SIDEBAR                                       */}
        {/* ======================================================== */}
        {isDesktop && (
          <View style={styles.sidebar}>
            {/* Logo: 字海 */}
            <View style={styles.sidebarLogoWrapper}>
              <TouchableOpacity activeOpacity={0.8} onPress={handleReset}>
                <ZihaiLogo size={32} />
              </TouchableOpacity>
            </View>

            {/* Navigation links: Search */}
            <View style={styles.sidebarNavList}>
              <TouchableOpacity
                style={[styles.sidebarItem, styles.sidebarItemActive]}
                activeOpacity={0.7}
              >
                <SearchIcon size={22} color="#4ade80" />
                <Text style={[styles.sidebarItemLabel, styles.sidebarItemLabelActive]}>Search</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* 2. MAIN CONTENT AREA (max-w-3xl, centered)               */}
        {/* ======================================================== */}
        <View style={[styles.contentArea, isDesktop && styles.contentAreaDesktop]}>
          {/* Mobile Top Header (Screens < 768px only) */}
          {!isDesktop && (
            <View style={styles.mobileTopBar}>
              <TouchableOpacity activeOpacity={0.8} onPress={handleReset}>
                <ZihaiLogo size={28} />
              </TouchableOpacity>

              {query.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleReset}
                  style={styles.mobileBackButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ChevronLeftIcon size={16} color="#4ade80" />
                  <Text style={styles.mobileBackButtonText}>Back</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.centerContainer}>
            {/* HERO SEARCH BAR */}
            <View style={styles.searchBarWrapper}>
              <View
                style={[
                  styles.searchPill,
                  (isFocused || query.length > 0) && styles.searchPillActive,
                ]}
              >
                <TouchableOpacity
                  style={styles.searchIconSlot}
                  onPress={query.length > 0 ? handleReset : undefined}
                  disabled={query.length === 0}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {query.length > 0 ? (
                    <ChevronLeftIcon size={22} color="#4ade80" />
                  ) : (
                    <SearchIcon
                      size={24}
                      color={isFocused ? '#4ade80' : '#bbf7d0'}
                    />
                  )}
                </TouchableOpacity>

                <TextInput
                  style={styles.searchInput}
                  placeholder="Search characters, pinyin, or English..."
                  placeholderTextColor="#bbf7d0"
                  value={query}
                  onChangeText={handleQueryChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onSubmitEditing={() => performSearch(query)}
                  returnKeyType="search"
                  clearButtonMode="never"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setQuery('');
                      setResults([]);
                      Keyboard.dismiss();
                    }}
                    style={styles.clearButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <XIcon size={18} color="#bbf7d0" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* RESULTS LIST OR EMPTY STATE */}
            {loading && results.length === 0 ? (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.statusState}>
                  <ActivityIndicator size="large" color="#4ade80" />
                </View>
              </TouchableWithoutFeedback>
            ) : results.length > 0 ? (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsHeader}>
                  {results.length} {results.length === 1 ? 'RESULT' : 'RESULTS'} FOUND
                </Text>

                <FlatList
                  data={results}
                  keyExtractor={(item, index) => `${item.id}_${item.simplified}_${index}`}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS === 'android'}
                  renderItem={({ item, index }) => (
                    <SearchResultCard
                      result={item}
                      index={index}
                      onPress={() => handleOpenWord(item)}
                    />
                  )}
                />
              </View>
            ) : query.trim() ? (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.statusState}>
                  <Text style={styles.emptyMessageText}>
                    No results found for &ldquo;{query}&rdquo;
                  </Text>
                </View>
              </TouchableWithoutFeedback>
            ) : (
              /* CLEAN EMPTY STATE: Quick character chips */
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.quickTagsContainer}>
                  <Text style={styles.quickTagsTitle}>POPULAR SEARCHES</Text>
                  <View style={styles.quickTagsGrid}>
                    {['你好', '谢谢', '中国', '朋友', '学习', '时间', '喜欢', '快乐', '再见', '爱'].map(
                      (tag) => (
                        <TouchableOpacity
                          key={tag}
                          style={styles.tagChip}
                          activeOpacity={0.7}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setQuery(tag);
                            performSearch(tag);
                          }}
                        >
                          <Text style={styles.tagChipText}>{tag}</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </View>

        {/* Word Detail Bento Modal */}
        <WordDetailModal
          visible={modalVisible}
          word={selectedWord}
          onClose={() => setModalVisible(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1c1a',
  },
  layoutRoot: {
    flex: 1,
    backgroundColor: '#1a1c1a',
    flexDirection: 'row',
    width: '100%',
    overflow: 'hidden',
  },

  // --- Desktop Sidebar ---
  sidebar: {
    width: 256,
    backgroundColor: 'rgba(42, 47, 42, 0.45)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(58, 65, 58, 0.5)',
    padding: 24,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
  },
  sidebarLogoWrapper: {
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  sidebarLogoText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1.5,
    fontFamily: Platform.select({
      web: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      default: undefined,
    }),
  },
  sidebarNavList: {
    flex: 1,
    gap: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  sidebarItemLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#bbf7d0',
    letterSpacing: 0.3,
  },
  sidebarItemLabelActive: {
    color: '#4ade80',
  },

  // --- Mobile Top Bar ---
  mobileTopBar: {
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  mobileBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(42, 47, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  mobileBackButtonText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
  },
  mobileLogoText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1.2,
    fontFamily: Platform.select({
      web: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      default: undefined,
    }),
  },

  // --- Main Content Area ---
  contentArea: {
    flex: 1,
    minHeight: '100%',
    minWidth: 0,
    width: '100%',
  },
  contentAreaDesktop: {
    paddingLeft: 256,
  },
  centerContainer: {
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
    paddingTop: 12,
    paddingBottom: 48,
    paddingHorizontal: 16,
    flex: 1,
    minWidth: 0,
  },

  // --- Search Bar ---
  searchBarWrapper: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 40,
    width: '100%',
  },
  searchPill: {
    width: '100%',
    height: 54,
    backgroundColor: 'rgba(34, 38, 34, 0.8)',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: 'rgba(58, 65, 58, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 50,
    paddingRight: 16,
  },
  searchPillActive: {
    borderColor: '#4ade80',
  },
  searchIconSlot: {
    position: 'absolute',
    left: 16,
    top: 13,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#f0fdf4',
    height: '100%',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 6,
    marginLeft: 8,
  },

  // --- Results List ---
  resultsContainer: {
    flex: 1,
    width: '100%',
    minWidth: 0,
  },
  resultsHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#86efac',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  listContent: {
    paddingBottom: 80,
  },

  // --- Status & Empty State ---
  statusState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyMessageText: {
    fontSize: 15,
    color: '#bbf7d0',
    textAlign: 'center',
  },

  // --- Quick Tags ---
  quickTagsContainer: {
    flex: 1,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  quickTagsTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#86efac',
    marginBottom: 14,
  },
  quickTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9999,
    backgroundColor: 'rgba(42, 47, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(58, 65, 58, 0.6)',
  },
  tagChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0fdf4',
  },
});
