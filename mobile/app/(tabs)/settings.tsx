import { StyleSheet, Linking, Pressable } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* App info */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.appName, { color: colors.tint }]}>NewsLens</Text>
        <Text style={[styles.tagline, { color: colors.subtitle }]}>
          AI-Powered Multi-Perspective News Aggregation for Sri Lanka
        </Text>
        <Text style={[styles.version, { color: colors.subtitle }]}>v0.2.0</Text>
      </View>

      {/* How it works */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>How It Works</Text>

        <View style={styles.step}>
          <Text style={[styles.stepIcon, { color: colors.tint }]}>1</Text>
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Scout Agent</Text>
            <Text style={[styles.stepDesc, { color: colors.subtitle }]}>
              Fetches articles from Sri Lankan RSS news sources
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={[styles.stepIcon, { color: colors.tint }]}>2</Text>
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Analyst Agent</Text>
            <Text style={[styles.stepDesc, { color: colors.subtitle }]}>
              Groups same-story articles using Gemini AI clustering
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={[styles.stepIcon, { color: colors.tint }]}>3</Text>
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Writer Agent</Text>
            <Text style={[styles.stepDesc, { color: colors.subtitle }]}>
              Generates neutral, factual summaries for each story
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={[styles.stepIcon, { color: colors.tint }]}>4</Text>
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Verifier Agent</Text>
            <Text style={[styles.stepDesc, { color: colors.subtitle }]}>
              Detects source bias and calculates confidence scores
            </Text>
          </View>
        </View>
      </View>

      {/* Bias labels legend */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Bias Labels</Text>
        {[
          { label: 'Neutral', desc: 'Balanced, factual reporting', color: colors.biasNeutral },
          { label: 'Pro-Government', desc: 'Favorable framing toward authority', color: colors.biasProGov },
          { label: 'Critical', desc: 'Critical or opposition framing', color: colors.biasCritical },
          { label: 'Sensationalist', desc: 'Emotionally charged language', color: colors.biasSensational },
        ].map((item) => (
          <View key={item.label} style={styles.biasRow}>
            <View style={[styles.biasDot, { backgroundColor: item.color }]} />
            <View style={styles.biasContent}>
              <Text style={[styles.biasLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.biasDesc, { color: colors.subtitle }]}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Credits */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Built With</Text>
        <Text style={[styles.techList, { color: colors.subtitle }]}>
          Expo / React Native{'\n'}
          FastAPI / Python{'\n'}
          Google Gemini AI{'\n'}
          Supabase (PostgreSQL){'\n'}
          RSS Feeds from Sri Lankan sources
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  // App info
  appName: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
  },
  // Steps
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  step: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepIcon: {
    fontSize: 18,
    fontWeight: '800',
    width: 24,
    textAlign: 'center',
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  // Bias
  biasRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  biasDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  biasContent: {
    flex: 1,
    gap: 1,
  },
  biasLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  biasDesc: {
    fontSize: 11,
  },
  // Tech
  techList: {
    fontSize: 13,
    lineHeight: 20,
  },
});
