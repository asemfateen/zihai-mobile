import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, FlatList, TouchableOpacity, Text, ActivityIndicator, SafeAreaView } from 'react-native';
import { api } from '../utils/api';
import { playTtsAudio } from '../utils/audio';
import { API_URL } from '../constants/config';
import * as Haptics from 'expo-haptics';

interface SearchResult {
  id: number;
  simplified: string;
  traditional: string | null;
  pinyin: string;
  definition: string;
  hsk_level: number;
}

export default function DictionaryScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<SearchResult[]>('/search', { q: query });
        setResults(data || []);
      } catch (err) {
        console.error('Search request failed:', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handlePlaySound = async (text: string) => {
    await playTtsAudio(text);
  };

  const getHskColor = (level: number) => {
    const colors: Record<number, string> = {
      1: '#10b981',
      2: '#3b82f6',
      3: '#8b5cf6',
      4: '#f59e0b',
      5: '#ef4444',
      6: '#ec4899',
    };
    return colors[level] || '#71717a';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search characters, pinyin, or English..."
          placeholderTextColor="#71717a"
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fbbf24" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.resultCard}>
              <View style={styles.cardHeader}>
                <TouchableOpacity onPress={() => handlePlaySound(item.simplified)}>
                  <Text style={styles.simplifiedText}>{item.simplified} <Text style={styles.speakerIcon}>🔊</Text></Text>
                </TouchableOpacity>
                {item.hsk_level > 0 && (
                  <View style={[styles.hskBadge, { backgroundColor: getHskColor(item.hsk_level) }]}>
                    <Text style={styles.hskText}>HSK {item.hsk_level}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.pinyinText}>{item.pinyin}</Text>
              <Text style={styles.definitionText}>{item.definition}</Text>
            </View>
          )}
          ListEmptyComponent={
            query.trim() ? (
              <Text style={styles.emptyText}>No characters or words found.</Text>
            ) : (
              <Text style={styles.emptyText}>Start typing to search the dictionary...</Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#18181b',
  },
  searchInput: {
    height: 50,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#f4f4f5',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  resultCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  simplifiedText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  speakerIcon: {
    fontSize: 16,
    color: '#a1a1aa',
  },
  hskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  hskText: {
    color: '#09090b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pinyinText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 6,
  },
  definitionText: {
    fontSize: 14,
    color: '#a1a1aa',
    lineHeight: 20,
  },
  emptyText: {
    color: '#71717a',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
    fontStyle: 'italic',
  },
});
