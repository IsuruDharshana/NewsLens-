import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getStoryDetail, getPreferences } from '@/lib/api';
import type { ClusterDetail, BiasAnalysis } from '@/lib/types';

export default function StoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [story, setStory] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (error || !story) {
    return (
      <View style={styles.center}>
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
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Breaking tag */}
        {story.is_breaking && (
          <View style={[styles.breakingTag, { backgroundColor: colors.breakingBackground }]}>
            <Text style={[styles.breakingText, { color: colors.breaking }]}>
              BREAKING NEWS
            </Text>
          </View>
        )}

        {/* Summary */}
        <Text style={[styles.summary, { color: colors.text }]}>
          {story.summary ?? 'No summary available for this story.'}
        </Text>

        {/* Stats row */}
        <View style={[styles.statsRow, { borderColor: colors.cardBorder }]}>
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
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
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
});
