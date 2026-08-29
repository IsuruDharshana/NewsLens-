import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { login, register, loading, error, clearError } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    if (!isLogin && !name.trim()) return;

    setSubmitting(true);
    clearError();
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim());
      }
    } catch {
      // Error is handled by auth context
    }
    setSubmitting(false);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    clearError();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo area */}
        <Text style={[styles.appName, { color: colors.tint }]}>NewsLens</Text>
        <Text style={[styles.tagline, { color: colors.subtitle }]}>
          Multi-Perspective News for Sri Lanka
        </Text>

        {/* Form */}
        <View style={styles.form}>
          {!isLogin && (
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
              placeholder="Full Name"
              placeholderTextColor={colors.subtitle}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!submitting}
            />
          )}

          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
            placeholder="Email"
            placeholderTextColor={colors.subtitle}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />

          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
            placeholder="Password"
            placeholderTextColor={colors.subtitle}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!submitting}
          />

          {error && (
            <Text style={[styles.errorText, { color: colors.breaking }]}>{error}</Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !email.trim() || !password.trim() || (!isLogin && !name.trim())}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.tint, opacity: pressed || submitting ? 0.7 : 1 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Log In' : 'Create Account'}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={toggleMode} disabled={submitting}>
            <Text style={[styles.toggleText, { color: colors.subtitle }]}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={{ color: colors.tint, fontWeight: '600' }}>
                {isLogin ? 'Sign Up' : 'Log In'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 14,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
