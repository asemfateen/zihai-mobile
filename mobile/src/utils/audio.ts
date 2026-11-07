import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

let cachedVoiceId: string | undefined = undefined;
let isWarmingUp = false;

/**
 * Pre-warms the native TTS engine connection and caches the best Chinese voice.
 * Calling this once on startup eliminates cold-start audio delay.
 */
export const initTts = async (): Promise<void> => {
  if (isWarmingUp || cachedVoiceId) return;
  isWarmingUp = true;

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
      }
      return;
    }

    const voices = await Speech.getAvailableVoicesAsync();
    // Prioritize high-quality/local Mandarin Chinese voices
    const zhVoice =
      voices.find(
        (v) =>
          (v.language.startsWith('zh') || v.language.includes('cmn')) &&
          (v.quality === Speech.VoiceQuality.Enhanced ||
            v.identifier.toLowerCase().includes('local') ||
            v.identifier.toLowerCase().includes('cmn-cn'))
      ) ||
      voices.find((v) => v.language.startsWith('zh') || v.language.includes('cmn'));

    if (zhVoice) {
      cachedVoiceId = zhVoice.identifier;
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[Zihai Audio] Warmup notice:', err);
    }
  } finally {
    isWarmingUp = false;
  }
};

export interface PlayTtsOptions {
  onStart?: () => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Plays high-quality Chinese TTS audio instantly.
 * Non-blocking, warmed-up execution.
 */
export const playTtsAudio = (text: string, options?: PlayTtsOptions): void => {
  if (!text || !text.trim()) return;

  const cleanText = text.trim();

  // 1. Web: native SpeechSynthesis API
  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const chineseVoice =
        voices.find(
          (v) =>
            (v.lang.startsWith('zh') || v.lang.includes('cmn')) &&
            (v.name.toLowerCase().includes('neural') ||
              v.name.toLowerCase().includes('online') ||
              v.name.toLowerCase().includes('natural') ||
              v.name.toLowerCase().includes('google') ||
              v.name.toLowerCase().includes('xiaoxiao') ||
              v.name.toLowerCase().includes('huihui'))
        ) ||
        voices.find((v) => v.lang.startsWith('zh') || v.lang.includes('cmn'));

      if (chineseVoice) {
        utterance.voice = chineseVoice;
      }

      utterance.onstart = () => options?.onStart?.();
      utterance.onend = () => options?.onDone?.();
      utterance.onerror = (e) => options?.onError?.(new Error(e.error));

      window.speechSynthesis.speak(utterance);
      return;
    } catch (err) {
      if (__DEV__) {
        console.warn('Web SpeechSynthesis notice:', err);
      }
      options?.onError?.(err as Error);
    }
  }

  // 2. Native Mobile (iOS / Android): zero-delay native expo-speech
  try {
    // Non-blocking cancel of any active speech
    Speech.stop().catch(() => {});

    Speech.speak(cleanText, {
      language: 'zh-CN',
      voice: cachedVoiceId,
      rate: 1.0,
      pitch: 1.0,
      onStart: () => options?.onStart?.(),
      onDone: () => options?.onDone?.(),
      onStopped: () => options?.onDone?.(),
      onError: (err) => options?.onError?.(err),
    });
  } catch (err) {
    if (__DEV__) {
      console.warn('Native Speech.speak notice:', err);
    }
    options?.onError?.(err as Error);
  }
};
