import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth';
import {
  getStoryDetail,
  getPreferences,
  getLikeStatus,
  toggleLike,
  getComments,
  addComment,
  deleteComment,
} from '@/lib/api';
import type { ClusterDetail, BiasAnalysis } from '@/lib/types';
import type { Comment } from '@/lib/api';
import { timeAgo } from '@/lib/time';
import { DetailSkeleton } from '@/components/Skeleton';

export default function StoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [story, setStory] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Engagement state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [togglingLike, setTogglingLike] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);

      // Load user language preference
      let lang = 'en';
      try {
        const prefs = await getPreferences();
        if (prefs.language) lang = prefs.language;
      } catch { /* default to en */ }

      try {
        const data = await getStoryDetail(id, lang);
        setStory(data);

        // Load engagement data in parallel
        const [likeData, commentsData] = await Promise.allSettled([
          getLikeStatus(id),
          getComments(id),
        ]);
        if (likeData.status === 'fulfilled') {
          setLiked(likeData.value.liked);
          setLikeCount(likeData.value.like_count);
        }
        if (commentsData.status === 'fulfilled') {
          setComments(commentsData.value);
        }
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load story');
      }
      setLoading(false);
    })();
  }, [id]);

  const biasColor = (label: string) => {
    switch (label) {
      case 'neutral': return colors.biasNeutral;
      case 'pro_government': return colors.biasProGov;
      case 'critical': return colors.biasCritical;
      case 'sensationalist': return colors.biasSensational;
      default: return colors.subtitle;
    }
  };

  const biasLabel = (label: string) => {
    switch (label) {
      case 'neutral': return 'Neutral';
      case 'pro_government': return 'Pro-Govt';
      case 'critical': return 'Critical';
      case 'sensationalist': return 'Sensational';
      default: return label;
    }
  };

  const renderBiasBar = (bias: BiasAnalysis) => {
    const total = bias.neutral + bias.pro_government + bias.critical + bias.sensationalist;
    if (total === 0) return null;

    const entries = [
      { key: 'neutral', count: bias.neutral, color: colors.biasNeutral },
      { key: 'pro_government', count: bias.pro_government, color: colors.biasProGov },
      { key: 'critical', count: bias.critical, color: colors.biasCritical },
      { key: 'sensationalist', count: bias.sensationalist, color: colors.biasSensational },
    ].filter((e) => e.count > 0);

    return (
      <View style={styles.biasSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Source Bias Breakdown</Text>
        {/* Stacked bar */}
        <View style={[styles.biasBar, { borderColor: colors.cardBorder }]}>
          {entries.map((entry) => (
            <View
              key={entry.key}
              style={{
                flex: entry.count,
                backgroundColor: entry.color,
                height: 8,
                borderRadius: 4,
              }}
            />
          ))}
        </View>
        {/* Legend */}
        <View style={styles.biasLegend}>
          {entries.map((entry) => (
            <View key={entry.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: entry.color }]} />
              <Text style={[styles.legendText, { color: colors.subtitle }]}>
                {biasLabel(entry.key)} ({entry.count})
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const handleToggleLike = useCallback(async () => {
    if (!id || togglingLike) return;
    setTogglingLike(true);
    try {
      const result = await toggleLike(id);
      setLiked(result.liked);
      setLikeCount(result.like_count);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Could not update like. Check that the likes table exists in Supabase.');
    }
    setTogglingLike(false);
  }, [id, togglingLike]);

  const handleAddComment = useCallback(async () => {
    if (!id || !commentText.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const newComment = await addComment(id, commentText.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentText('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Could not add comment. Check that the comments table exists in Supabase.');
    }
    setPostingComment(false);
  }, [id, commentText, postingComment]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      Alert.alert('Error', 'Could not delete comment');
    }
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <DetailSkeleton />
      </View>
    );
  }

  if (error || !story) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={[styles.errorText, { color: colors.breaking }]}>
          {error ?? 'Story not found'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: story.category,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.tint,
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, paddingBottom: insets.bottom }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
        >
          {/* Category + time */}
          <View style={styles.metaRow}>
            <View style={[styles.categoryTag, { backgroundColor: colors.categoryBg }]}>
              <Text style={[styles.categoryTagText, { color: colors.categoryText }]}>
                {story.category}
              </Text>
            </View>
            {story.published_at && (
              <Text style={[styles.publishedTime, { color: colors.subtitle }]}>
                {timeAgo(story.published_at)}
              </Text>
            )}
          </View>

          {/* Breaking tag */}
          {story.is_breaking && (
            <View style={[styles.breakingTag, { backgroundColor: colors.breakingBackground }]}>
              <Text style={[styles.breakingText, { color: colors.breaking }]}>
                BREAKING NEWS
              </Text>
            </View>
          )}

          {/* Headline title — never blank */}
          <Text style={[styles.headline, { color: colors.text }]}>
            {story.title?.trim() ||
              story.summary?.split('.')[0]?.trim() ||
              (story.sources[0]?.name ? `${story.sources[0].name} report` : 'News story')}
          </Text>

          {/* Summary */}
          <Text style={[styles.summary, { color: colors.text }]}>
            {story.title?.trim()
              ? story.summary
              : story.summary?.split('.').slice(1).join('.').trim() || story.summary ||
                'No summary available for this story.'}
          </Text>

          {/* Like + stats row */}
          <View style={[styles.statsRow, { borderColor: colors.cardBorder }]}>
            <Pressable onPress={handleToggleLike} style={styles.likeButton}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={24}
                color={liked ? '#e74c3c' : colors.subtitle}
              />
              <Text style={[styles.likeCount, { color: liked ? '#e74c3c' : colors.subtitle }]}>
                {likeCount}
              </Text>
            </Pressable>
            <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.tint }]}>
                {story.source_count}
              </Text>
              <Text style={[styles.statLabel, { color: colors.subtitle }]}>Sources</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.stat}>
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      story.confidence_score >= 0.6
                        ? colors.confidence
                        : story.confidence_score >= 0.4
                          ? '#ffc107'
                          : colors.breaking,
                  },
                ]}
              >
                {Math.round(story.confidence_score * 100)}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.subtitle }]}>Confidence</Text>
            </View>
          </View>

          {/* Bias breakdown */}
          {story.bias_analysis && renderBiasBar(story.bias_analysis)}

          {/* Sources list */}
          <View style={styles.sourcesSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Sources ({story.sources.length})
            </Text>
            {story.sources.map((source, i) => (
              <Pressable
                key={i}
                onPress={() => Linking.openURL(source.url)}
                style={({ pressed }) => [
                  styles.sourceRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.sourceInfo}>
                  <Text style={[styles.sourceName, { color: colors.text }]}>{source.name}</Text>
                  {source.bias_label && (
                    <View
                      style={[
                        styles.biasBadge,
                        { backgroundColor: biasColor(source.bias_label) + '20' },
                      ]}
                    >
                      <Text style={[styles.biasBadgeText, { color: biasColor(source.bias_label) }]}>
                        {biasLabel(source.bias_label)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.openLink, { color: colors.tint }]}>Open →</Text>
              </Pressable>
            ))}
          </View>

          {/* Comments section */}
          <View style={styles.commentsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Comments ({comments.length})
            </Text>
            {comments.length === 0 && (
              <Text style={[styles.noComments, { color: colors.subtitle }]}>
                No comments yet. Be the first to share your thoughts.
              </Text>
            )}
            {comments.map((c) => {
              const isOwn = c.user_id === user?.user_id;
              const initials = (c.user_name || 'A').charAt(0).toUpperCase();
              return (
                <View key={c.id} style={[styles.commentRow, { borderColor: colors.cardBorder }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.tint + '20' }]}>
                    <Text style={[styles.avatarText, { color: colors.tint }]}>{initials}</Text>
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={[styles.commentAuthor, { color: colors.text }]}>
                        {c.user_name}
                      </Text>
                      <Text style={[styles.commentTime, { color: colors.subtitle }]}>
                        {timeAgo(c.created_at)}
                      </Text>
                    </View>
                    <Text style={[styles.commentText, { color: colors.text }]}>{c.text}</Text>
                    {isOwn && (
                      <Pressable onPress={() => handleDeleteComment(c.id)} style={styles.deleteBtn}>
                        <Text style={[styles.deleteText, { color: colors.breaking }]}>
                          Delete
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Comment input bar */}
        <View style={[styles.commentInputBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <TextInput
            style={[styles.commentInput, { color: colors.text, borderColor: colors.cardBorder }]}
            placeholder="Add a comment..."
            placeholderTextColor={colors.subtitle}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={500}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleAddComment}
          />
          <Pressable
            onPress={handleAddComment}
            disabled={!commentText.trim() || postingComment}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: commentText.trim() ? colors.tint : colors.subtitle + '40',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {postingComment ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  publishedTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Breaking
  breakingTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  breakingText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Headline
  headline: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
  },
  // Summary
  summary: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    gap: 24,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  // Bias
  biasSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  biasBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    gap: 2,
  },
  biasLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  // Sources
  sourcesSection: {
    gap: 10,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sourceInfo: {
    flex: 1,
    gap: 4,
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '600',
  },
  biasBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  biasBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  openLink: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Like button
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeCount: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Comments
  commentsSection: {
    gap: 10,
  },
  noComments: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  commentBody: {
    flex: 1,
    gap: 4,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
  },
  commentTime: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteBtn: {
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
