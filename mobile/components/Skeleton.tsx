import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle, useColorScheme } from 'react-native';

interface SkeletonProps {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
          backgroundColor: isDark ? '#334155' : '#cbd5e1',
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
      <Skeleton width="100%" height={160} borderRadius={0} />
      <View style={styles.body}>
        <View style={styles.row}>
          <Skeleton width={70} height={18} borderRadius={4} />
          <Skeleton width={90} height={14} borderRadius={4} />
        </View>
        <Skeleton width="85%" height={20} borderRadius={4} />
        <Skeleton width="100%" height={16} borderRadius={4} />
        <Skeleton width="60%" height={16} borderRadius={4} />
        <View style={styles.footer}>
          <Skeleton width={80} height={14} borderRadius={4} />
          <Skeleton width={50} height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

export function BannerSkeleton() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <View style={[styles.banner, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
      <View style={styles.row}>
        <Skeleton width={100} height={14} borderRadius={4} />
        <Skeleton width={24} height={24} borderRadius={12} />
      </View>
      <Skeleton width="90%" height={18} borderRadius={4} />
      <Skeleton width="50%" height={14} borderRadius={4} />
    </View>
  );
}

export function DetailSkeleton() {
  return (
    <View style={styles.detail}>
      <Skeleton width={120} height={24} borderRadius={4} />
      <Skeleton width="95%" height={28} borderRadius={4} />
      <Skeleton width="100%" height={18} borderRadius={4} />
      <Skeleton width="100%" height={18} borderRadius={4} />
      <Skeleton width="75%" height={18} borderRadius={4} />
      <View style={[styles.row, { marginTop: 8 }]}>
        <Skeleton width="30%" height={60} borderRadius={10} />
        <Skeleton width="30%" height={60} borderRadius={10} />
        <Skeleton width="30%" height={60} borderRadius={10} />
      </View>
      <Skeleton width={140} height={20} borderRadius={4} />
      <Skeleton width="100%" height={56} borderRadius={10} />
      <Skeleton width="100%" height={56} borderRadius={10} />
      <Skeleton width="100%" height={56} borderRadius={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#cbd5e1',
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  body: {
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    padding: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  detail: {
    padding: 16,
    gap: 14,
  },
});
