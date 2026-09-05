import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getNews, getBreakingNews, getPreferences, askQuestion, searchNews, API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ClusterListItem, Category, RAGResponse } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { timeAgo } from '@/lib/time';
import { stripHtml } from '@/lib/text';
import { CardSkeleton, BannerSkeleton } from '@/components/Skeleton';
import { NewsImage } from '@/components/NewsImage';

export default function HomeFeed() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLandscape = width > 600;

  const [clusters, setClusters] = useState<ClusterListItem[]>([]);
  const [breaking, setBreaking] = useState<ClusterListItem[]>([]);
  const [dismissedBreakingIds, setDismissedBreakingIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [userLang, setUserLang] = useState<string>('en');

  // RAG "Ask about the news" state
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [ragAnswer, setRagAnswer] = useState<RAGResponse | null>(null);
  const [ragError, setRagError] = useState<string | null>(null);

  // Full-text search state. `searchResults: null` means not in search mode.
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ClusterListItem[] | null>(null);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Header icon toggles: which inline panel/overlay is currently open.
  // These are independent of the search results / RAG answer state — closing
  // the input bar just hides the bar; existing results/answers remain in the
  // feed until the user explicitly clears them.
  const [searchOpen, setSearchOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const isSearching = searchResults !== null;

  // Imperative nav for setting headerRight on the tabs header.
  const navigation = useNavigation();

  // Toggles for the 3 header icons. Search and ask are mutually exclusive so
  // the user only ever sees one input bar open at a time — same as the
  // original behaviour where the ask bar was hidden in search mode.
  const toggleSearch = useCallback(() => {
    setSearchOpen((v) => {
      if (!v) setAskOpen(false);
      return !v;
    });
  }, []);
  const toggleAsk = useCallback(() => {
    setAskOpen((v) => {
      if (!v) setSearchOpen(false);
      return !v;
    });
  }, []);
  const openFilter = useCallback(() => {
    // If we're in search mode, exit it before opening the filter so the
    // category filter applies to the regular feed (matches the old behaviour
    // where category chips were hidden during search).
    if (searchResults) {
      setSearchQuery('');
      setSearchResults(null);
      setSearchTotal(0);
      setSearchError(null);
    }
    setFilterOpen(true);
  }, [searchResults]);
  const closeFilter = useCallback(() => setFilterOpen(false), []);

  // Inject the 3 headerRight icons (search, ask-AI, filter) into the tabs
  // header. We use a function form so the icons can read the latest state on
  // every render. Re-runs whenever any of the inputs change.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRight}>
          <Pressable
            onPress={toggleSearch}
            hitSlop={8}
            style={styles.headerIconButton}
            accessibilityLabel="Search news"
          >
            <Ionicons
              name="search"
              size={22}
              color={searchOpen ? colors.tint : colors.text}
            />
          </Pressable>
          <Pressable
            onPress={toggleAsk}
            hitSlop={8}
            style={styles.headerIconButton}
            accessibilityLabel="Ask AI about the news"
          >
            <Ionicons
              name="sparkles"
              size={22}
              color={askOpen ? colors.tint : colors.text}
            />
          </Pressable>
          <Pressable
            onPress={openFilter}
            hitSlop={8}
            style={styles.headerIconButton}
            accessibilityLabel="Filter by category"
          >
            <Ionicons
              name="filter"
              size={22}
              color={filterOpen || selectedCategory !== 'All' ? colors.tint : colors.text}
            />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, searchOpen, askOpen, filterOpen, selectedCategory, colorScheme, toggleSearch, toggleAsk, openFilter]);

  const handleAsk = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setRagError(null);
    setRagAnswer(null);
    try {
      const result = await askQuestion(trimmed);
      setRagAnswer(result);
    } catch (err: any) {
      setRagError(
        err?.response?.data?.detail ?? err?.message ?? 'Could not get an answer. Try again.',
      );
    }
    setAsking(false);
  }, [question, asking]);

  const clearAnswer = useCallback(() => {
    setRagAnswer(null);
    setRagError(null);
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2 || searching) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]); // enter search mode immediately so the UI swaps
    setSearchTotal(0);
    try {
      const res = await searchNews(trimmed, 1, 30);
      setSearchResults(res.data);
      setSearchTotal(res.pagination.total);
    } catch (err: any) {
      setSearchError(
        err?.response?.data?.detail ?? err?.message ?? 'Search failed. Try again.',
      );
      setSearchResults([]); // stay in search mode so the error is visible
    }
    setSearching(false);
  }, [searchQuery, searching]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchTotal(0);
    setSearchError(null);
  }, []);

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

  const dismissBreaking = useCallback((storyId: string) => {
    setDismissedBreakingIds((prev) => new Set(prev).add(storyId));
  }, []);

  const renderBreakingBanner = () => {
    const visibleBreaking = breaking.filter((s) => !dismissedBreakingIds.has(s.id));
    if (visibleBreaking.length === 0) return null;
    const story = visibleBreaking[0];
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/story/[id]', params: { id: story.id } })}
        style={({ pressed }) => [
          styles.breakingBanner,
          { backgroundColor: colors.breakingBackground, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={styles.breakingHeader}>
          <View style={styles.breakingTitleRow}>
            <Ionicons name="flash" size={14} color={colors.breaking} />
            <Text style={[styles.breakingLabel, { color: colors.breaking }]}>BREAKING NEWS</Text>
          </View>
          <Pressable
            onPress={() => dismissBreaking(story.id)}
            hitSlop={10}
            style={styles.breakingClose}
            accessibilityLabel="Dismiss breaking news"
          >
            <Ionicons name="close" size={18} color={colors.subtitle} />
          </Pressable>
        </View>
        <Text style={[styles.breakingTopic, { color: colors.subtitle }]} numberOfLines={1}>
          {story.category}
        </Text>
        <Text style={[styles.breakingTitle, { color: colors.text }]} numberOfLines={2}>
          {stripHtml(story.title ?? story.summary).trim() || 'Breaking story developing...'}
        </Text>
        <Text style={[styles.breakingHint, { color: colors.subtitle }]}>
          Tap to read →
        </Text>
      </Pressable>
    );
  };

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={[styles.searchInputRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Ionicons name="search" size={16} color={colors.subtitle} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search news"
          placeholderTextColor={colors.subtitle}
          value={searchQuery}
          onChangeText={setSearchQuery}
          editable={!searching}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          maxLength={200}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {isSearching ? (
          <Pressable onPress={clearSearch} hitSlop={8} style={styles.searchClear}>
            <Ionicons name="close-circle" size={20} color={colors.subtitle} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSearch}
            disabled={searchQuery.trim().length < 2 || searching}
            style={({ pressed }) => [
              styles.searchButton,
              {
                backgroundColor:
                  searchQuery.trim().length >= 2 && !searching
                    ? colors.tint
                    : colors.subtitle + '40',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );

  const renderAskBar = () => (
    <View style={styles.askContainer}>
      <Text style={[styles.askLabel, { color: colors.subtitle }]}>Ask about the news</Text>
      <View style={[styles.askInputRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <TextInput
          style={[styles.askInput, { color: colors.text }]}
          placeholder="e.g. What happened with the economy this week?"
          placeholderTextColor={colors.subtitle}
          value={question}
          onChangeText={setQuestion}
          editable={!asking}
          returnKeyType="send"
          onSubmitEditing={handleAsk}
          maxLength={500}
        />
        <Pressable
          onPress={handleAsk}
          disabled={!question.trim() || asking}
          style={({ pressed }) => [
            styles.askButton,
            {
              backgroundColor: question.trim() && !asking ? colors.tint : colors.subtitle + '40',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          {asking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={16} color="#fff" />
          )}
        </Pressable>
      </View>
    </View>
  );

  const renderAnswer = () => {
    if (asking) {
      return (
        <View style={[styles.answerCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <ActivityIndicator size="small" color={colors.tint} />
          <Text style={[styles.answerLoading, { color: colors.subtitle }]}>
            Searching recent news...
          </Text>
        </View>
      );
    }
    if (ragError) {
      return (
        <View style={[styles.answerCard, { backgroundColor: colors.card, borderColor: colors.breaking }]}>
          <View style={styles.answerHeader}>
            <Text style={[styles.answerTitle, { color: colors.breaking }]}>Error</Text>
            <Pressable onPress={clearAnswer} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.subtitle} />
            </Pressable>
          </View>
          <Text style={[styles.answerText, { color: colors.text }]}>{ragError}</Text>
        </View>
      );
    }
    if (ragAnswer) {
      return (
        <View style={[styles.answerCard, { backgroundColor: colors.card, borderColor: colors.tint }]}>
          <View style={styles.answerHeader}>
            <Text style={[styles.answerTitle, { color: colors.tint }]}>Answer</Text>
            <Pressable onPress={clearAnswer} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.subtitle} />
            </Pressable>
          </View>
          <Text style={[styles.answerQuestion, { color: colors.subtitle }]} numberOfLines={2}>
            {ragAnswer.question}
          </Text>
          <Text style={[styles.answerText, { color: colors.text }]}>{ragAnswer.answer}</Text>
          {ragAnswer.sources.length > 0 && (
            <View style={styles.sourcesList}>
              <Text style={[styles.sourcesLabel, { color: colors.subtitle }]}>Sources</Text>
              {ragAnswer.sources.map((src, i) => (
                <Pressable
                  key={`${src.url}-${i}`}
                  onPress={() => Linking.openURL(src.url)}
                  style={({ pressed }) => [
                    styles.sourceLink,
                    { borderColor: colors.cardBorder, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.sourceLinkName, { color: colors.tint }]} numberOfLines={1}>
                    [{src.name}] {src.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  const renderFilterStatus = () => {
    if (selectedCategory === 'All') return null;
    return (
      <View style={styles.filterStatusBar}>
        <Ionicons name="filter" size={13} color={colors.tint} />
        <Text style={[styles.filterStatusText, { color: colors.tint }]}>
          Showing: {selectedCategory}
        </Text>
        <Pressable
          onPress={() => setSelectedCategory('All')}
          hitSlop={8}
          style={styles.filterStatusClear}
          accessibilityLabel="Clear category filter"
        >
          <Ionicons name="close-circle" size={16} color={colors.subtitle} />
        </Pressable>
      </View>
    );
  };

  const renderNewsCard = ({ item }: { item: ClusterListItem }) => {
    const relativeTime = timeAgo(item.published_at);
    const rawTitle = stripHtml(item.title).trim();
    const rawSummary = stripHtml(item.summary).trim();
    const firstSentence = rawSummary?.split('.')[0]?.trim();
    const displayTitle = rawTitle || firstSentence || 'News story';
    const displaySummary = rawTitle
      ? rawSummary
      : rawSummary?.split('.').slice(1).join('.').trim() || '';

    return (
      <Pressable
        onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id } })}
        style={({ pressed }) => [
          styles.card,
          isLandscape && styles.cardLandscape,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        {/* Hero image with automatic placeholder fallback */}
        <NewsImage
          uri={item.image_url}
          category={item.category}
          style={[styles.hero, isLandscape && styles.heroLandscape]}
          resizeMode="cover"
        />

        {/* Card body */}
        <View style={[styles.cardBody, isLandscape && styles.cardBodyLandscape]}>
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
                {Math.round(item.confidence_score * 100)}%
              </Text>
            </View>
          </View>

          {/* Title — always show a heading so context is never missing */}
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {displayTitle}
          </Text>

          {/* Summary */}
          {displaySummary ? (
            <Text style={[styles.summary, { color: colors.text }]} numberOfLines={2}>
              {displaySummary}
            </Text>
          ) : null}

          {/* Footer: time + source count + engagement */}
          <View style={styles.cardFooter}>
            <View style={styles.footerLeft}>
              {relativeTime ? (
                <Text style={[styles.timeText, { color: colors.subtitle }]}>
                  {relativeTime}
                </Text>
              ) : null}
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
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <BannerSkeleton />
        <View style={styles.skeletonList}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={[styles.errorTitle, { color: colors.breaking }]}>Connection Error</Text>
        <Text style={[styles.errorText, { color: colors.subtitle }]}>
          {error}
          {'\n\n'}
          Backend: {API_BASE_URL}
          {'\n'}
          {API_BASE_URL.includes('localhost')
            ? 'This build is pointing at a local server. Rebuild the APK with the production URL.'
            : 'The server may be waking up (free tier). Wait a moment and retry.'}
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
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Greeting */}
      <View style={styles.greetingBar}>
        <Text style={[styles.greetingText, { color: colors.subtitle }]}>
          Hello, <Text style={{ color: colors.text, fontWeight: '600' }}>{user?.name?.split(' ')[0] ?? 'there'}</Text>
        </Text>
      </View>
      {/* Search input — only visible when the user taps the header search icon */}
      {searchOpen && renderSearchBar()}
      {/* Ask AI input — only visible when the user taps the header ask-AI icon */}
      {askOpen && renderAskBar()}
      {/* Active filter status pill (only when a non-default filter is applied
          and the user is on the regular feed, not in search mode) */}
      {selectedCategory !== 'All' && !isSearching && renderFilterStatus()}
      {renderAnswer()}
      {/* Breaking banner hidden in search mode (search is its own filter) */}
      {!isSearching && renderBreakingBanner()}
      <FlatList
        data={isSearching ? (searchResults ?? []) : clusters}
        keyExtractor={(item) => item.id}
        renderItem={renderNewsCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          // Only allow pull-to-refresh on the regular feed, not search results
          isSearching ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.tint}
            />
          )
        }
        ListHeaderComponent={
          isSearching ? (
            <View style={styles.searchHeader}>
              {searching ? (
                <Text style={[styles.searchHeaderText, { color: colors.subtitle }]}>
                  Searching for “{searchQuery.trim()}”…
                </Text>
              ) : searchError ? (
                <Text style={[styles.searchHeaderText, { color: colors.breaking }]}>
                  {searchError}
                </Text>
              ) : (
                <Text style={[styles.searchHeaderText, { color: colors.subtitle }]}>
                  {searchTotal} result{searchTotal === 1 ? '' : 's'} for “{searchQuery.trim()}”
                </Text>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          isSearching ? (
            searching ? null : (
              <View style={styles.center}>
                <Ionicons name="search-outline" size={36} color={colors.subtitle} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No results
                </Text>
                <Text style={[styles.emptyText, { color: colors.subtitle }]}>
                  We couldn’t find any stories matching “{searchQuery.trim()}”.{'\n'}Try a different keyword.
                </Text>
              </View>
            )
          ) : (
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: colors.subtitle }]}>
                No stories found.{'\n'}Pull to refresh.
              </Text>
            </View>
          )
        }
      />

      {/* Category dropdown — opens from the filter icon, anchored under the
          tabs header. Tapping the backdrop or selecting a category closes it. */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        onRequestClose={closeFilter}
      >
        <Pressable style={styles.filterBackdrop} onPress={closeFilter}>
          <Pressable
            style={[styles.filterDropdown, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => {/* swallow taps so they don't bubble to the backdrop */}}
          >
            <View style={styles.filterDropdownHeader}>
              <Text style={[styles.filterDropdownTitle, { color: colors.text }]}>
                Filter by category
              </Text>
              <Pressable onPress={closeFilter} hitSlop={8} accessibilityLabel="Close filter">
                <Ionicons name="close" size={20} color={colors.subtitle} />
              </Pressable>
            </View>
            {CATEGORIES.map((cat) => {
              const isActive = cat === selectedCategory;
              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    setSelectedCategory(cat);
                    closeFilter();
                  }}
                  style={({ pressed }) => [
                    styles.filterDropdownItem,
                    {
                      backgroundColor: isActive ? colors.tint + '15' : 'transparent',
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterDropdownItemText,
                      { color: isActive ? colors.tint : colors.text },
                    ]}
                  >
                    {cat}
                  </Text>
                  {isActive && <Ionicons name="checkmark" size={18} color={colors.tint} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
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
  skeletonList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
    marginTop: 8,
  },
  // Breaking banner
  breakingBanner: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef444440',
    gap: 6,
  },
  breakingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  breakingLabel: {
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  breakingClose: {
    padding: 4,
    marginRight: -4,
  },
  breakingTopic: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  breakingTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  breakingHint: {
    fontSize: 11,
    marginTop: 2,
  },
  breakingText: {
    fontSize: 13,
    flex: 1,
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
  // Header right icons (search, ask-AI, filter)
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerIconButton: {
    padding: 6,
  },
  // Active filter status pill
  filterStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  filterStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterStatusClear: {
    padding: 2,
  },
  // Category dropdown modal
  filterBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 88, // leave room for the tabs header above
    paddingHorizontal: 16,
  },
  filterDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  filterDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterDropdownTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filterDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  filterDropdownItemText: {
    fontSize: 15,
    fontWeight: '500',
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
    overflow: 'hidden',
  },
  cardLandscape: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 180,
  },
  hero: {
    width: '100%',
    height: 160,
  },
  heroLandscape: {
    width: 240,
    height: '100%',
  },
  cardBody: {
    padding: 14,
    gap: 10,
    flex: 1,
  },
  cardBodyLandscape: {
    justifyContent: 'space-between',
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
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
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
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    rowGap: 4,
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
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  searchIcon: {
    marginLeft: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 80,
  },
  searchButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClear: {
    padding: 4,
  },
  searchHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  searchHeaderText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
    textAlign: 'center',
  },
  // Ask about the news (RAG)
  askContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  askLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  askInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 8,
  },
  askInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 80,
  },
  askButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  answerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  answerTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  answerQuestion: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  answerText: {
    fontSize: 15,
    lineHeight: 22,
  },
  answerLoading: {
    fontSize: 14,
    textAlign: 'center',
  },
  sourcesList: {
    gap: 6,
    paddingTop: 4,
  },
  sourcesLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sourceLink: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  sourceLinkName: {
    fontSize: 13,
    fontWeight: '600',
  },
});
