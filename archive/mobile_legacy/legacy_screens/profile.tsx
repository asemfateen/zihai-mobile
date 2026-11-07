import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Text, ActivityIndicator, SafeAreaView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

interface Stats {
  email: string;
  display_name: string | null;
  created_at: string;
  favorites_count: number;
  flashcards_reviewed: number;
  flashcards_due: number;
}

interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
  current_progress: number;
  is_unlocked: boolean;
  unlocked_at: string | null;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfileData = async () => {
    try {
      const statsData = await api.get<Stats>('/profile');
      const achData = await api.get<Achievement[]>('/achievements');
      setStats(statsData);
      setAchievements(achData || []);
    } catch (err) {
      console.error('Failed to load profile details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Info Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.display_name || user?.email || 'Z').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.displayName}>{user?.display_name || user?.email.split('@')[0]}</Text>
          <Text style={styles.emailText}>{user?.email}</Text>
          <Text style={styles.joinedText}>
            Joined {stats ? new Date(stats.created_at).toLocaleDateString() : ''}
          </Text>
        </View>

        {/* Stats Grid */}
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats?.favorites_count || 0}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats?.flashcards_reviewed || 0}</Text>
            <Text style={styles.statLabel}>Reviewed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats?.flashcards_due || 0}</Text>
            <Text style={styles.statLabel}>Due Today</Text>
          </View>
        </View>

        {/* Achievements Section */}
        <Text style={styles.sectionTitle}>Achievements</Text>
        {achievements.map((ach) => {
          const progressPercent = Math.min(1, ach.current_progress / ach.requirement_value);
          
          return (
            <View key={ach.id} style={[styles.achCard, !ach.is_unlocked && styles.lockedCard]}>
              <View style={styles.achHeader}>
                <Text style={styles.achIcon}>{ach.icon || '🏆'}</Text>
                <View style={styles.achMeta}>
                  <Text style={styles.achName}>{ach.name}</Text>
                  <Text style={styles.achDesc}>{ach.description}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {ach.current_progress} / {ach.requirement_value}
                </Text>
              </View>

              {ach.is_unlocked && (
                <Text style={styles.unlockedDate}>
                  Unlocked {new Date(ach.unlocked_at || '').toLocaleDateString()}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fbbf24',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#d97706',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#09090b',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 15,
    color: '#a1a1aa',
    marginBottom: 8,
  },
  joinedText: {
    fontSize: 12,
    color: '#71717a',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginBottom: 16,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  statLabel: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 4,
  },
  achCard: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  lockedCard: {
    opacity: 0.6,
  },
  achHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  achIcon: {
    fontSize: 36,
  },
  achMeta: {
    flex: 1,
  },
  achName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f4f4f5',
  },
  achDesc: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 2,
    lineHeight: 18,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#09090b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fbbf24',
    width: 50,
    textAlign: 'right',
  },
  unlockedDate: {
    fontSize: 11,
    color: '#10b981',
    marginTop: 10,
    textAlign: 'right',
  },
});
