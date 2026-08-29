import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getNews, getBreakingNews, getPreferences } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ClusterListItem, Category } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

export default function HomeFeed() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  const [clusters, setClusters] = useState<ClusterListItem[]>([]);
  const [breaking, setBreaking] = useState<ClusterListItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [userLang, setUserLang] = useState<string>('en');

  // Load user preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const prefs = await getPreferences();
        if (prefs.categories && prefs.categories.length > 0) {
          const firstPref = prefs.categories[0];
          if (CATEGORIES.includes(firstPref as Category)) {
            setSelectedCategory(firstPref as Category);
          }
        }
        if (prefs.language) setUserLang(prefs.language);
      } catch { /* default to 'All' / English */ }
      setPrefsLoaded(true);
    })();
  }, []);

  // Reload language preference when screen gains focus (after settings change)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const prefs = await getPreferences();
          if (prefs.language) setUserLang(prefs.language);
        } catch { /* ignore */ }
      })();
    }, [])
  );

  const fetchNews = useCallback(async (category?: string, lang?: string) => {
    try {
      setError(null);
      const [newsRes, breakingRes] = await Promise.all([
        getNews(1, 30, category, lang),
        getBreakingNews(lang),
      ]);
      setClusters(newsRes.data);
      setBreaking(breakingRes.data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load news');
    }
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    (async () => {
      setLoading(true);
      await fetchNews(selectedCategory, userLang);
      setLoading(false);
    })();
  }, [selectedCategory, fetchNews, prefsLoaded, userLang]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNews(selectedCategory, userLang);
    setRefreshing(false);
  };

  const renderBreakingBanner = () => {
    if (breaking.length === 0) return null;
    return (
      <View style={[styles.breakingBanner, { backgroundColor: colors.breakingBackground }]}>
        <Text style={[styles.breakingLabel, { color: colors.breaking }]}>BREAKING</Text>
        <Text style={[styles.breakingText, { color: colors.text }]} numberOfLines={1}>
          {breaking[0].summary ?? 'Breaking story developing...'}
        </Text>
      </View>
    );
  };

  const renderCategoryChips = () => (
    <View style={styles.chipsContainer}>
      {CATEGORIES.map((cat) => {
        const isActive = cat === selectedCategory;
        return (
          <Pressable
            key={cat}
            onPress={() => setSelectedCategory(cat)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? colors.tint : colors.categoryBg,
                borderColor: isActive ? colors.tint : colors.cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: isActive ? '#fff' : colors.categoryText },
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderNewsCard = ({ item }: { item: ClusterListItem }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id } })}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Category + Confidence row */}
      <View style={styles.cardHeader}>
        <View style={[styles.categoryTag, { backgroundColor: colors.categoryBg }]}>
          <Text style={[styles.categoryTagText, { color: colors.categoryText }]}>
            {item.category}
          </Text>
        </View>
        <View style={styles.confidenceRow}>
          <View
            style={[
              styles.confidenceDot,
              {
                backgroundColor:
                  item.confidence_score >= 0.6
                    ? colors.confidence
                    : item.confidence_score >= 0.4
                      ? '#ffc107'
                      : colors.breaking,
              },
            ]}
          />
          <Text style={[styles.confidenceText, { color: colors.subtitle }]}>
            {Math.round(item.confidence_score * 100)}% confidence
          </Text>
        </View>
      </View>

      {/* Summary */}
      <Text style={[styles.summary, { color: colors.text }]} numberOfLines={3}>
        {item.summary ?? 'Summary not available'}
      </Text>

      {/* Footer: source count + engagement */}
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <Text style={[styles.sourceCount, { color: colors.subtitle }]}>
            {item.source_count} source{item.source_count !== 1 ? 's' : ''}
          </Text>
          <View style={styles.engagementRow}>
            <Ionicons name="heart-outline" size={13} color={colors.subtitle} />
            <Text style={[styles.engagementText, { color: colors.subtitle }]}>
              {item.like_count ?? 0}
            </Text>
            <Ionicons
              name="chatbubble-outline"
              size={13}
              color={colors.subtitle}
              style={{ marginLeft: 8 }}
            />
            <Text style={[styles.engagementText, { color: colors.subtitle }]}>
              {item.comment_count ?? 0}
            </Text>
          </View>
        </View>
        {item.is_breaking && (
          <Text style={[styles.breakingTag, { color: colors.breaking }]}>Breaking</Text>
        )}
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.loadingText, { color: colors.subtitle }]}>Loading news...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={[styles.errorTitle, { color: colors.breaking }]}>Connection Error</Text>
        <Text style={[styles.errorText, { color: colors.subtitle }]}>
          {error}{'\n\n'}Make sure the backend is running at localhost:8000
        </Text>
        <Pressable
          onPress={() => fetchNews(selectedCategory, userLang)}
          style={[styles.retryButton, { backgroundColor: colors.tint }]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Greeting */}
      <View style={styles.greetingBar}>
        <Text style={[styles.greetingText, { color: colors.subtitle }]}>
          Hello, <Text style={{ color: colors.text, fontWeight: '600' }}>{user?.name?.split(' ')[0] ?? 'there'}</Text>
        </Text>
      </View>
      {renderBreakingBanner()}
      {renderCategoryChips()}
      <FlatList
        data={clusters}
        keyExtractor={(item) => item.id}
        renderItem={renderNewsCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tint}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.subtitle }]}>
              No stories found.{'\n'}Pull to refresh.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Breaking banner
  breakingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  // Greeting
  greetingBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  greetingText: {
    fontSize: 14,
  },
  breakingLabel: {
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  breakingText: {
    fontSize: 13,
    flex: 1,
  },
  // Category chips
  chipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // News list
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  // Card
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  confidenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  engagementText: {
    fontSize: 12,
    fontWeight: '500',
  },
  breakingTag: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
