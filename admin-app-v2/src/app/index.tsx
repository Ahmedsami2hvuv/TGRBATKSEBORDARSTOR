import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // التحقق المسبق من وجود الجلسة
  useEffect(() => {
    checkLoginSession();
  }, []);

  async function checkLoginSession() {
    try {
      const loggedIn = await AsyncStorage.getItem('admin_logged_in');
      if (loggedIn === 'true') {
        router.replace('/dashboard');
      } else {
        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!password) {
      Alert.alert('خطأ', 'الرجاء إدخال رمز الدخول');
      return;
    }

    setLoading(true);
    
    // جلب الرمز من بيئة العمل أو استخدام "admin" كافتراضي إذا لم يتم العثور عليه
    const expectedPassword = process.env.EXPO_PUBLIC_ADMIN_PASSWORD || 'admin';

    if (password === expectedPassword) {
      // حفظ الجلسة وتوجيه المستخدم
      try {
        await AsyncStorage.setItem('admin_logged_in', 'true');
        router.replace('/dashboard');
      } catch (e) {
        Alert.alert('خطأ', 'فشل في حفظ بيانات الدخول');
        setLoading(false);
      }
    } else {
      Alert.alert('مرفوض', 'رمز الدخول غير صحيح');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>لوحة الإدارة</Text>
        <Text style={styles.subtitle}>الرجاء إدخال رمز الوصول السري</Text>

        <TextInput
          style={styles.input}
          placeholder="رمز الدخول (كلمة المرور)"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogin} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>تسجيل الدخول</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    textAlign: 'right',
  },
  button: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
