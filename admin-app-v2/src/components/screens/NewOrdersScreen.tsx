import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NewOrdersScreen() {
  const [activeTab, setActiveTab] = useState('new'); // new, preparing, completed

  return (
    <View style={styles.container}>
      {/* Top Actions */}
      <View style={styles.topActions}>
        <Text style={styles.pageTitle}>إدارة الطلبات والتجهيز</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>تتبع الطلبات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>سجل التجهيز</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>+ طلب إداري جديد</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'new' && styles.activeTabNew]} 
            onPress={() => setActiveTab('new')}
          >
            <Text style={[styles.tabText, activeTab === 'new' && styles.activeTabTextNew]}>الطلبات الجديدة (0)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'preparing' && styles.activeTabPreparing]} 
            onPress={() => setActiveTab('preparing')}
          >
            <Text style={[styles.tabText, activeTab === 'preparing' && styles.activeTabTextPreparing]}>قيد التجهيز (0)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'completed' && styles.activeTabCompleted]} 
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabTextCompleted]}>مكتمل التجهيز (0)</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* List Content */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>لا توجد طلبات حالياً في هذا القسم</Text>
        </View>
        {/* سيتم هنا عرض كروت الطلبات بنفس تصميم الموقع */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topActions: {
    padding: 16,
    backgroundColor: 'white',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnSecondaryText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabsContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabsScroll: {
    flexDirection: 'row',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#64748b',
  },
  activeTabNew: {
    borderBottomColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  activeTabTextNew: {
    color: '#0369a1',
  },
  activeTabPreparing: {
    borderBottomColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  activeTabTextPreparing: {
    color: '#b45309',
  },
  activeTabCompleted: {
    borderBottomColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  activeTabTextCompleted: {
    color: '#047857',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  }
});
