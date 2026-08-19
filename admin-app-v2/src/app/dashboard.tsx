import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type AdminTile = {
  slug: string;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
};

const ADMIN_TILES: AdminTile[] = [
  { slug: "store", label: "المتجر", iconName: "cart", color: "#3b82f6", bgColor: "#eff6ff" },
  { slug: "admin-create-order", label: "إضافة طلب", iconName: "add-circle", color: "#6366f1", bgColor: "#eef2ff" },
  { slug: "new-orders", label: "الطلبات الجديدة", iconName: "cube", color: "#f59e0b", bgColor: "#fffbeb" },
  { slug: "order-tracking", label: "تتبع الطلبات", iconName: "map", color: "#a855f7", bgColor: "#faf5ff" },
  { slug: "shops", label: "المحلات", iconName: "storefront", color: "#10b981", bgColor: "#ecfdf5" },
  { slug: "couriers", label: "المندوبين", iconName: "bicycle", color: "#ec4899", bgColor: "#fdf2f8" },
  { slug: "preparers", label: "المجهزين", iconName: "build", color: "#14b8a6", bgColor: "#f0fdfa" },
  { slug: "employees", label: "الموظفين", iconName: "people", color: "#8b5cf6", bgColor: "#f5f3ff" },
  { slug: "suppliers", label: "الموردين", iconName: "bus", color: "#f43f5e", bgColor: "#fff1f2" },
  { slug: "reports", label: "التقارير", iconName: "bar-chart", color: "#84cc16", bgColor: "#f7fee7" },
  { slug: "credit-book", label: "دفتر الديون", iconName: "book", color: "#6366f1", bgColor: "#eef2ff" },
  { slug: "customers", label: "بيانات الزبائن", iconName: "person", color: "#d946ef", bgColor: "#fdf4ff" },
  { slug: "archived-orders", label: "الطلبات المؤرشفة", iconName: "archive", color: "#f59e0b", bgColor: "#fffbeb" },
  { slug: "rejected-orders", label: "المرفوضة", iconName: "close-circle", color: "#ef4444", bgColor: "#fef2f2" },
  { slug: "regions", label: "المناطق", iconName: "navigate", color: "#6366f1", bgColor: "#eef2ff" },
  { slug: "settings", label: "الإعدادات", iconName: "settings", color: "#64748b", bgColor: "#f8fafc" },
];

export default function DashboardScreen() {
  const router = useRouter();

  const handleTilePress = (slug: string) => {
    router.push(`/dashboard/${slug}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerRight}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AK</Text>
          </View>
          <Text style={styles.headerTitle}>أبو الأكبر للتوصيل</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/')}>
          <Ionicons name="log-out-outline" size={20} color="#ff3b30" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          {ADMIN_TILES.map((tile) => (
            <TouchableOpacity
              key={tile.slug}
              style={[styles.tile, { backgroundColor: tile.bgColor, borderColor: tile.color + '40' }]}
              onPress={() => handleTilePress(tile.slug)}
            >
              <View style={styles.iconContainer}>
                <Ionicons name={tile.iconName} size={28} color={tile.color} />
              </View>
              <Text style={[styles.tileLabel, { color: tile.color }]}>{tile.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  avatarText: {
    fontWeight: '900',
    color: '#4f46e5',
    fontSize: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iconContainer: {
    marginBottom: 12,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  }
});
