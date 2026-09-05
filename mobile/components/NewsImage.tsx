import { useState } from 'react';
import { Image, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type NewsImageProps = {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  category?: string;
  accessibilityLabel?: string;
};

/**
 * Image wrapper for news cards and story headers.
 *
 * Renders the remote image when available. If the URL is missing or the
 * download fails, it falls back to a branded placeholder that looks like an
 * intentional image preview slot rather than an empty gap.
 */
export function NewsImage({
  uri,
  style,
  resizeMode = 'cover',
  category,
  accessibilityLabel,
}: NewsImageProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [failed, setFailed] = useState(false);

  const showPlaceholder = !uri || failed;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.tint + '14' },
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      {!showPlaceholder && (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode={resizeMode}
          onError={() => setFailed(true)}
        />
      )}
      {showPlaceholder && (
        <View style={styles.placeholder}>
          <Ionicons name="newspaper-outline" size={40} color={colors.tint + '55'} />
          {category ? (
            <Text style={[styles.category, { color: colors.tint + '88' }]}>
              {category}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  category: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
