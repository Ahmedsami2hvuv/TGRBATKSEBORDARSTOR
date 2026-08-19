import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const router = useRouter();

  const handleLogout = () => {
    // العودة إلى شاشة تسجيل الدخول
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* شريط العنوان */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>لوحة التحكم الرئيسية</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>خروج</Text>
          </TouchableOpacity>
        </View>

        {/* قسم الإحصائيات السريعة */}
        <Text style={styles.sectionTitle}>نظرة عامة</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>150</Text>
            <Text style={styles.statLabel}>طلبات اليوم</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>24</Text>
            <Text style={styles.statLabel}>مندوب نشط</Text>
          </View>
        </View>

        {/* الأقسام والأزرار الرئيسية */}
        <Text style={styles.sectionTitle}>أقسام التطبيق</Text>
        <View style={styles.gridContainer}>
          <TouchableOpacity style={styles.gridButton}>
            <Text style={styles.gridButtonIcon}>📦</Text>
            <Text style={styles.gridButtonText}>إدارة الطلبات</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridButton}>
            <Text style={styles.gridButtonIcon}>🛵</Text>
            <Text style={styles.gridButtonText}>المندوبين</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridButton}>
            <Text style={styles.gridButtonIcon}>👥</Text>
            <Text style={styles.gridButtonText}>المستخدمين</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridButton}>
            <Text style={styles.gridButtonIcon}>⚙️</Text>
            <Text style={styles.gridButtonText}>الإعدادات</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    direction: 'rtl', // لدعم اللغة العربية
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  logoutButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'right',
  },
  statsContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: 'white',
    width: '48%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0a7ea4',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  gridContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridButton: {
    backgroundColor: 'white',
    width: '48%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  gridButtonIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  gridButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});
