import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import 'react-native-reanimated';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/lib/auth';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Enforce auth on every navigation. The conditional Stack rendering below
  // already keeps protected screens out of the unauthenticated branch, but
  // this effect is what guarantees an unauthenticated user is bounced to
  // /login the moment they try to reach a protected route (or a deep link
  // lands them there), and an authenticated user is bounced away from /login
  // back to the home feed. Runs on every segment change.
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(tabs)' || segments[0] === 'story';
    if (!user && inAuthGroup) {
      router.replace('/login');
    } else if (user && segments[0] === 'login') {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, router]);

  // Show a loading screen while checking auth
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // If not logged in, show only the login screen. This is the first-frame
  // safety net; the useEffect above handles subsequent navigations.
  if (!user) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
        </Stack>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="story/[id]"
          options={{ headerShown: true, title: 'Story' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
