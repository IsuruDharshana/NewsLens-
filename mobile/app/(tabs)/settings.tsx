import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth';
import { getPreferences, updatePreferences, type UserPreferences } from '@/lib/api';
import { CATEGORIES } from '@/lib/types';

const SPORTS_OPTIONS = ['Cricket', 'Football', 'Rugby', 'Athletics', 'Swimming', 'Badminton', 'Tennis'] as const;
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'si', label: 'සිංහල (Sinhala)' },
] as const;

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user, logout } = useAuth();

  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await getPreferences();
        setPrefs(p);
      } catch {
        // Set defaults if API fails
        setPrefs({
          user_id: user?.user_id ?? '',
          categories: [],
          language: 'en',
          notification_enabled: true,
          sports_interests: [],
        });
      }
    })();
  }, []);

  const save = async (updated: UserPreferences) => {
    setPrefs(updated);
    setDirty(true);
    setSaving(true);
    try {
      const saved = await updatePreferences({
        categories: updated.categories,
        language: updated.language,
        notification_enabled: updated.notification_enabled,
        sports_interests: updated.sports_interests,
      });
      setPrefs(saved);
      setDirty(false);
    } catch {
      // Keep local state on failure
    }
    setSaving(false);
  };

  const toggleCategory = (cat: string) => {
    if (!prefs) return;
    const next = prefs.categories.includes(cat)
      ? prefs.categories.filter((c) => c !== cat)
      : [...prefs.categories, cat];
    save({ ...prefs, categories: next });
  };

  const toggleSport = (sport: string) => {
    if (!prefs) return;
    const next = prefs.sports_interests.includes(sport)
      ? prefs.sports_interests.filter((s) => s !== sport)
      : [...prefs.sports_interests, sport];
    save({ ...prefs, sports_interests: next });
  };

  const setLanguage = (lang: string) => {
    if (!prefs) return;
    save({ ...prefs, language: lang });
  };

  // Filter out 'All' from category chips in preferences
  const prefCategories = CATEGORIES.filter((c) => c !== 'All');

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* User info */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.userName, { color: colors.text }]}>{user?.name ?? 'User'}</Text>
        <Text style={[styles.userEmail, { color: colors.subtitle }]}>{user?.email ?? ''}</Text>
      </View>

      {/* Language */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Language</Text>
        <View style={styles.chipsRow}>
          {LANGUAGES.map((lang) => {
            const isActive = prefs?.language === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => setLanguage(lang.code)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? colors.tint : colors.categoryBg,
                    borderColor: isActive ? colors.tint : colors.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: isActive ? '#fff' : colors.categoryText }]}>
                  {lang.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {prefs?.language === 'si' && (
          <Text style={[styles.hint, { color: colors.subtitle }]}>
            Sinhala summaries use AI with journalistic style prompting. Quality improves over time.
          </Text>
        )}
      </View>

      {/* Category preferences */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferred Categories</Text>
        <Text style={[styles.hint, { color: colors.subtitle }]}>
          Select topics to prioritize in your feed. Leave empty to see all news.
        </Text>
        <View style={styles.chipsWrap}>
          {prefCategories.map((cat) => {
            const isActive = prefs?.categories.includes(cat);
            return (
              <Pressable
                key={cat}
                onPress={() => toggleCategory(cat)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? colors.tint : colors.categoryBg,
                    borderColor: isActive ? colors.tint : colors.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: isActive ? '#fff' : colors.categoryText }]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Sports interests */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sports Interests</Text>
        <Text style={[styles.hint, { color: colors.subtitle }]}>
          Prioritize these sports in the Sports category.
        </Text>
        <View style={styles.chipsWrap}>
          {SPORTS_OPTIONS.map((sport) => {
            const isActive = prefs?.sports_interests.includes(sport);
            return (
              <Pressable
                key={sport}
                onPress={() => toggleSport(sport)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? colors.tint : colors.categoryBg,
                    borderColor: isActive ? colors.tint : colors.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: isActive ? '#fff' : colors.categoryText }]}>
                  {sport}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
          Supabase (PostgreSQL + Auth){'\n'}
          RSS Feeds from Sri Lankan sources
        </Text>
        <Text style={[styles.version, { color: colors.subtitle }]}>NewsLens v0.3.0</Text>
      </View>

      {/* Logout */}
      <Pressable
        onPress={logout}
        style={({ pressed }) => [
          styles.logoutButton,
          { borderColor: colors.breaking, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.logoutText, { color: colors.breaking }]}>Log Out</Text>
      </Pressable>

      {/* Saving indicator */}
      {saving && (
        <View style={styles.savingBar}>
          <ActivityIndicator size="small" color={colors.tint} />
          <Text style={[styles.savingText, { color: colors.subtitle }]}>Saving preferences...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
  },
  // User info
  userName: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 13,
    textAlign: 'center',
  },
  // Sections
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  // Chips
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipsWrap: {
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
  // Steps
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
  version: {
    fontSize: 11,
    textAlign: 'center',
  },
  // Logout
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 24,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Saving
  savingBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 20,
  },
  savingText: {
    fontSize: 12,
  },
});
