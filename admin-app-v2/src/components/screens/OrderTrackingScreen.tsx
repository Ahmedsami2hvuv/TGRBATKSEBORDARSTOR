import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OrderTrackingScreen() {
  const [search, setSearch] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>تتبع الطلبات</Text>
        <Text style={styles.pageSubtitle}>ابحث عن أي طلب لمتابعة حالته</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="رقم الطلب، رقم الهاتف، أو اسم الزبون..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          <TouchableOpacity style={[styles.filterChip, styles.activeChip]}>
            <Text style={[styles.filterText, styles.activeFilterText]}>الكل</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterText}>قيد التوصيل</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterText}>مكتمل</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterText}>راجع / مرفوض</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterText}>مؤجل</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        <View style={styles.emptyState}>
          <Ionicons name="map-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>لم يتم العثور على طلبات</Text>
          <Text style={styles.emptySubText}>أدخل رقم الطلب في مربع البحث للبدء.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerArea: {
    padding: 16,
    backgroundColor: 'white',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    textAlign: 'right',
    fontSize: 15,
  },
  filtersContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeChip: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0284c7',
  },
  filterText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  activeFilterText: {
    color: 'white',
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
    fontWeight: 'bold',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
  }
});
