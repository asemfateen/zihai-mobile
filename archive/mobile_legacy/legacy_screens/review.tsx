import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { api } from '../utils/api';
import { playTtsAudio } from '../utils/audio';
import { API_URL } from '../constants/config';
import * as Haptics from 'expo-haptics';

interface Flashcard {
  id: number;
  character: string;
  pinyin: string;
  english_definition: string;
  hsk_level: number;
}

export default function ReviewScreen() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchDueCards = async () => {
    setLoading(true);
    try {
      const data = await api.get<Flashcard[]>('/flashcards/due');
      setCards(data || []);
      setCurrentIndex(0);
      setRevealed(false);
    } catch (err) {
      console.error('Failed to fetch due flashcards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDueCards();
  }, []);

  const handlePlaySound = async (text: string) => {
    await playTtsAudio(text);
  };

  const handleSeedCards = async () => {
    setSeeding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post('/flashcards/seed');
      await fetchDueCards();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Failed to seed starter cards:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSeeding(false);
    }
  };

  const submitRating = async (quality: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const card = cards[currentIndex];
    
    try {
      await api.post(`/flashcards/${card.id}/result`, { quality });
      
      if (currentIndex + 1 < cards.length) {
        setCurrentIndex(currentIndex + 1);
        setRevealed(false);
      } else {
        // Deck complete!
        setCards([]);
        setCurrentIndex(0);
        setRevealed(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.error('Failed to submit card review result:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>You're All Caught Up!</Text>
          <Text style={styles.emptySubtitle}>
            No flashcards are due for review. Keep studying new units to build your deck!
          </Text>

          <TouchableOpacity
            style={[styles.seedButton, seeding && styles.disabledButton]}
            onPress={handleSeedCards}
            disabled={seeding}
          >
            {seeding ? (
              <ActivityIndicator size="small" color="#09090b" />
            ) : (
              <Text style={styles.seedButtonText}>Seed 5 Starter Cards</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Indicator */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${((currentIndex + 1) / cards.length) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>
        Card {currentIndex + 1} of {cards.length}
      </Text>

      {/* Main Flashcard Container */}
      <View style={styles.cardContainer}>
        <View style={styles.card}>
          <TouchableOpacity onPress={() => handlePlaySound(currentCard.character)}>
            <Text style={styles.characterText}>{currentCard.character}</Text>
          </TouchableOpacity>
          <Text style={styles.speakHint}>Tap character to hear pronunciation 🔊</Text>

          {revealed ? (
            <View style={styles.revealedSection}>
              <Text style={styles.pinyinText}>{currentCard.pinyin}</Text>
              <Text style={styles.definitionText}>{currentCard.english_definition}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.revealButton} onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setRevealed(true);
            }}>
              <Text style={styles.revealText}>Show Translation</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rating Buttons */}
      {revealed && (
        <View style={styles.ratingSection}>
          <TouchableOpacity style={[styles.ratingBtn, { backgroundColor: '#ef4444' }]} onPress={() => submitRating(1)}>
            <Text style={styles.ratingText}>Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ratingBtn, { backgroundColor: '#f59e0b' }]} onPress={() => submitRating(3)}>
            <Text style={styles.ratingText}>Hard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ratingBtn, { backgroundColor: '#3b82f6' }]} onPress={() => submitRating(4)}>
            <Text style={styles.ratingText}>Good</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ratingBtn, { backgroundColor: '#10b981' }]} onPress={() => submitRating(5)}>
            <Text style={styles.ratingText}>Easy</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 72,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  seedButton: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 24,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 200,
  },
  seedButtonText: {
    color: '#09090b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#18181b',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
  },
  progressText: {
    color: '#71717a',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 20,
    width: '100%',
    maxWidth: 360,
    aspectRatio: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  characterText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fbbf24',
    textAlign: 'center',
  },
  speakHint: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 12,
    marginBottom: 40,
  },
  revealButton: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  revealText: {
    color: '#09090b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  revealedSection: {
    width: '100%',
    alignItems: 'center',
  },
  pinyinText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginBottom: 10,
  },
  definitionText: {
    fontSize: 16,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 22,
  },
  ratingSection: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderColor: '#18181b',
  },
  ratingBtn: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
