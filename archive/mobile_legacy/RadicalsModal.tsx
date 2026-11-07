import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { api } from '../utils/api';
import { Colors } from '../constants/theme';

interface RadicalItem {
  id: number;
  character: string;
  name: string;
  count?: number;
}

interface RadicalsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectRadical: (radical: RadicalItem) => void;
}

export const RadicalsModal: React.FC<RadicalsModalProps> = ({
  visible,
  onClose,
  onSelectRadical,
}) => {
  const [radicals, setRadicals] = useState<RadicalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!visible) return;

    const fetchRadicals = async () => {
      setLoading(true);
      try {
        const data = await api.get<RadicalItem[]>('/radicals');
        setRadicals(data || []);
      } catch (err) {
        console.error('Failed to load radicals list:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRadicals();
  }, [visible]);

  const filteredRadicals = radicals.filter((r) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase().trim();
    return (
      r.character.includes(q) ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      String(r.id) === q
    );
  });

  const C = Colors.dark;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>214 Kangxi Radicals (部首)</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="Filter by name, character, or number..."
            placeholderTextColor={C.textMuted}
            value={filter}
            onChangeText={setFilter}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>Loading radicals...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredRadicals}
            keyExtractor={(item) => String(item.id)}
            numColumns={3}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.radCard}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onSelectRadical(item);
                  onClose();
                }}
              >
                <Text style={styles.radId}>#{item.id}</Text>
                <Text style={styles.radChar}>{item.character}</Text>
                <Text style={styles.radName} numberOfLines={1}>{item.name}</Text>
                {item.count != null && item.count > 0 && (
                  <Text style={styles.radCount}>{item.count} chars</Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>No radicals match "{filter}"</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const C = Colors.dark;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  headerTitle: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: C.textMuted,
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchBox: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  input: {
    height: 46,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: C.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  listContent: {
    padding: 8,
  },
  radCard: {
    flex: 1 / 3,
    backgroundColor: C.card,
    borderRadius: 14,
    margin: 6,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  radId: {
    fontSize: 11,
    color: C.textMuted,
    alignSelf: 'flex-start',
  },
  radChar: {
    fontSize: 32,
    fontWeight: '900',
    color: C.textPrimary,
    marginVertical: 4,
  },
  radName: {
    fontSize: 12,
    color: C.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  radCount: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: C.textMuted,
    marginTop: 10,
    fontSize: 14,
  },
  emptyText: {
    color: C.textMuted,
    fontSize: 14,
  },
});
