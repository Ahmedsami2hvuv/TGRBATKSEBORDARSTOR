import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const TILE_TITLES: Record<string, string> = {
  "store": "إدارة المتجر",
  "admin-create-order": "إضافة طلب جديد",
  "new-orders": "الطلبات الجديدة",
  "order-tracking": "تتبع الطلبات",
  "shops": "إدارة المحلات",
  "couriers": "إدارة المندوبين",
  "preparers": "المجهزين",
  "employees": "الموظفين",
  "suppliers": "الموردين",
  "reports": "التقارير",
  "credit-book": "دفتر الديون",
  "customers": "بيانات الزبائن",
  "archived-orders": "الطلبات المؤرشفة",
  "rejected-orders": "الطلبات المرفوضة",
  "regions": "المناطق",
  "settings": "الإعدادات",
};

import NewOrdersScreen from '../../components/screens/NewOrdersScreen';
import OrderTrackingScreen from '../../components/screens/OrderTrackingScreen';
import CreateOrderScreen from '../../components/screens/CreateOrderScreen';

export default function GenericModuleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  if (slug === 'new-orders') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>الرجوع للوحة التحكم</Text>
          <View style={{ width: 40 }} />
        </View>
        <NewOrdersScreen />
      </SafeAreaView>
    );
  }

  if (slug === 'order-tracking') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>الرجوع للوحة التحكم</Text>
          <View style={{ width: 40 }} />
        </View>
        <OrderTrackingScreen />
      </SafeAreaView>
    );
  }

  if (slug === 'admin-create-order') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>الرجوع للوحة التحكم</Text>
          <View style={{ width: 40 }} />
        </View>
        <CreateOrderScreen />
      </SafeAreaView>
    );
  }

  const title = slug && TILE_TITLES[slug] ? TILE_TITLES[slug] : "قسم الإدارة";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Ionicons name="construct-outline" size={64} color="#94a3b8" />
        <Text style={styles.title}>جاري برمجة شاشة {title}</Text>
        <Text style={styles.subtitle}>هذه الشاشة قيد التصميم ليتم مطابقتها تماماً مع الموقع الأصلي بأدوات الهاتف (Native).</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  }
});
