import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '@/api/auth'
import { useAuthStore, persistUser } from '@/stores/authStore'
import { saveTokens } from '@/api/client'

export default function LoginScreen() {
  const { setUser } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال البريد الإلكتروني وكلمة المرور')
      return
    }
    setLoading(true)
    try {
      const { data: tokens } = await authApi.login(email.trim(), password)
      await saveTokens(tokens.accessToken, tokens.refreshToken)
      const { data: profile } = await authApi.me()
      await persistUser(profile)
      setUser(profile)
      router.replace('/(app)/pos')
    } catch {
      Alert.alert('خطأ في تسجيل الدخول', 'البريد الإلكتروني أو كلمة المرور غير صحيحة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>flowIn</Text>
        <Text style={styles.subtitle}>نظام نقاط البيع</Text>

        <TextInput
          style={styles.input}
          placeholder="البريد الإلكتروني"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textAlign="right"
        />
        <TextInput
          style={styles.input}
          placeholder="كلمة المرور"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textAlign="right"
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>تسجيل الدخول</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#10b981',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#f8fafc',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  btn: {
    width: '100%',
    backgroundColor: '#10b981',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
