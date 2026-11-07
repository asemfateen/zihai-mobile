import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { api } from '../utils/api';
import { playTtsAudio } from '../utils/audio';
import { API_URL } from '../constants/config';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StrokeCanvas } from '../components/StrokeCanvas';

interface Question {
  id: string;
  type: 'meaning' | 'pinyin' | 'listening' | 'writing';
  targetWord: {
    id: number;
    character: string;
    pinyin: string;
    english_definition: string;
  };
  options: Array<{ text: string; isCorrect: boolean }>;
}

export default function QuizScreen() {
  const { unitId } = useLocalSearchParams();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);

  const fetchLessonQuestions = async () => {
    try {
      const data = await api.get<{ questions: Question[] }>(`/lessons/${unitId}`);
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Failed to load lesson questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unitId) {
      fetchLessonQuestions();
    }
  }, [unitId]);

  const handlePlaySound = async (text: string) => {
    await playTtsAudio(text);
  };

  const handleOptionSelect = (optionIdx: number, isCorrect: boolean) => {
    if (answered) return;
    
    setSelectedOption(optionIdx);
    setAnswered(true);

    if (isCorrect) {
      setCorrectCount(correctCount + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleWritingDone = () => {
    setCorrectCount(correctCount + 1);
    setAnswered(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleNext = async () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setAnswered(false);
    } else {
      // Quiz complete! Save progress
      setIsFinished(true);
      setSavingProgress(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      try {
        const xpToGain = 20; // 20 XP per lesson
        await api.post('/progress/lesson-complete', {
          xpGained: xpToGain,
          unit: unitId
        });
        setXpEarned(xpToGain);
      } catch (err) {
        console.error('Failed to save user progress:', err);
      } finally {
        setSavingProgress(false);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No questions found for this unit.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isFinished) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.finishedContainer}>
          <Text style={styles.finishedIcon}>🏆</Text>
          <Text style={styles.finishedTitle}>Unit Completed!</Text>
          <Text style={styles.finishedSubtitle}>
            Great job! You answered {correctCount} out of {questions.length} questions correctly.
          </Text>

          <View style={styles.xpCard}>
            {savingProgress ? (
              <ActivityIndicator size="small" color="#fbbf24" />
            ) : (
              <>
                <Text style={styles.xpGainedText}>+ {xpEarned} XP</Text>
                <Text style={styles.xpLabel}>Added to your profile</Text>
              </>
            )}
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={() => router.replace('/')}>
            <Text style={styles.doneButtonText}>Finish Journey Step</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentIndex];
  const target = currentQuestion.targetWord;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Progress bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
      </View>

      <View style={styles.quizContent}>
        {/* Prompt Header */}
        <Text style={styles.promptHeader}>
          {currentQuestion.type === 'meaning' && 'Select the correct translation:'}
          {currentQuestion.type === 'pinyin' && 'Select the correct Pinyin:'}
          {currentQuestion.type === 'listening' && 'Listen and select the matching character:'}
          {currentQuestion.type === 'writing' && 'Draw the character:'}
        </Text>

        {/* Question Panel */}
        <View style={currentQuestion.type === 'writing' ? styles.writingPanel : styles.questionPanel}>
          {currentQuestion.type === 'listening' ? (
            <TouchableOpacity style={styles.soundButton} onPress={() => handlePlaySound(target.character)}>
              <Text style={styles.soundIcon}>🔊</Text>
              <Text style={styles.soundLabel}>Play Pronunciation</Text>
            </TouchableOpacity>
          ) : currentQuestion.type === 'writing' ? (
            <View style={styles.writingArea}>
              <Text style={styles.writingPromptText}>
                Trace character: <Text style={styles.writingTargetText}>{target.character}</Text>
              </Text>
              <StrokeCanvas />
            </View>
          ) : (
            <>
              <Text style={styles.promptCharacter}>{target.character}</Text>
              {currentQuestion.type === 'pinyin' && <Text style={styles.promptTranslation}>{target.english_definition}</Text>}
            </>
          )}
        </View>

        {/* Options Panel or Writing Action */}
        {currentQuestion.type === 'writing' ? (
          !answered && (
            <TouchableOpacity style={styles.doneWritingBtn} onPress={handleWritingDone}>
              <Text style={styles.doneWritingBtnText}>Finished Writing</Text>
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = option.isCorrect;
              
              let btnStyle: any = styles.optionBtn;
              let textStyle: any = styles.optionText;

              if (answered) {
                if (isCorrect) {
                  btnStyle = [styles.optionBtn, styles.correctBtn];
                  textStyle = [styles.optionText, styles.correctText];
                } else if (isSelected) {
                  btnStyle = [styles.optionBtn, styles.incorrectBtn];
                  textStyle = [styles.optionText, styles.incorrectText];
                } else {
                  btnStyle = [styles.optionBtn, styles.disabledBtn];
                }
              }

              return (
                <TouchableOpacity
                  key={idx}
                  style={btnStyle}
                  onPress={() => handleOptionSelect(idx, option.isCorrect)}
                  disabled={answered}
                >
                  <Text style={textStyle}>{option.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Footer Next button */}
        {answered && (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {currentIndex + 1 < questions.length ? 'Next Question' : 'View Results'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
    padding: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#09090b',
    fontWeight: 'bold',
    fontSize: 16,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#18181b',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
  },
  quizContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  promptHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4f4f5',
    textAlign: 'center',
    marginTop: 10,
  },
  questionPanel: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    marginVertical: 24,
  },
  promptCharacter: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  promptTranslation: {
    fontSize: 16,
    color: '#a1a1aa',
    marginTop: 16,
    textAlign: 'center',
  },
  soundButton: {
    alignItems: 'center',
  },
  soundIcon: {
    fontSize: 48,
    color: '#fbbf24',
  },
  soundLabel: {
    color: '#a1a1aa',
    marginTop: 12,
    fontSize: 14,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionBtn: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  optionText: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '600',
  },
  correctBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  correctText: {
    color: '#10b981',
  },
  incorrectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  incorrectText: {
    color: '#ef4444',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  nextButton: {
    backgroundColor: '#fbbf24',
    height: 54,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#09090b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  finishedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  finishedIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  finishedTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 12,
    textAlign: 'center',
  },
  finishedSubtitle: {
    fontSize: 15,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  xpCard: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: 40,
    minWidth: 200,
  },
  xpGainedText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10b981',
  },
  xpLabel: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 4,
  },
  doneButton: {
    backgroundColor: '#fbbf24',
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 240,
  },
  doneButtonText: {
    color: '#09090b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  writingPanel: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  writingArea: {
    width: '100%',
    alignItems: 'center',
  },
  writingPromptText: {
    fontSize: 18,
    color: '#a1a1aa',
    marginBottom: 16,
  },
  writingTargetText: {
    color: '#fbbf24',
    fontWeight: 'bold',
    fontSize: 24,
  },
  doneWritingBtn: {
    backgroundColor: '#fbbf24',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  doneWritingBtnText: {
    color: '#09090b',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
