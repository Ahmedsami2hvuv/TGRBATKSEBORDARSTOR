import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CreateOrderScreen() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>إضافة طلب إداري جديد</Text>
        <Text style={styles.pageSubtitle}>أدخل بيانات الزبون والطلب الجديد</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>معلومات الزبون</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput 
            style={styles.input} 
            placeholder="07..." 
            keyboardType="phone-pad"
            value={customerPhone}
            onChangeText={setCustomerPhone}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>اسم الزبون (اختياري)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="مثال: أحمد" 
            value={customerName}
            onChangeText={setCustomerName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>العنوان التفصيلي</Text>
          <TextInput 
            style={[styles.input, styles.textArea]} 
            placeholder="المنطقة، الشارع، أقرب نقطة دالة..." 
            multiline
            numberOfLines={3}
            value={address}
            onChangeText={setAddress}
          />
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>معلومات الطلب</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>المبلغ الكلي (مع التوصيل)</Text>
          <View style={styles.priceInputContainer}>
            <Text style={styles.currencyLabel}>د.ع</Text>
            <TextInput 
              style={styles.priceInput} 
              placeholder="0" 
              keyboardType="number-pad"
              value={price}
              onChangeText={setPrice}
            />
          </View>
        </View>

        <View style={styles.switchGroup}>
          <View style={styles.switchLabelContainer}>
            <Text style={styles.switchLabel}>طلب مستعجل؟</Text>
            <Text style={styles.switchSubLabel}>يظهر بلون مميز للمندوبين</Text>
          </View>
          <Switch 
            value={isUrgent} 
            onValueChange={setIsUrgent} 
            trackColor={{ false: "#cbd5e1", true: "#fca5a5" }}
            thumbColor={isUrgent ? "#ef4444" : "#f8fafc"}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.submitBtn}>
        <Ionicons name="checkmark-circle-outline" size={24} color="white" />
        <Text style={styles.submitBtnText}>حفظ وإنشاء الطلب</Text>
      </TouchableOpacity>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
  },
  headerArea: {
    marginBottom: 20,
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
  formCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    textAlign: 'right',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
  },
  currencyLabel: {
    paddingHorizontal: 12,
    color: '#64748b',
    fontWeight: 'bold',
  },
  priceInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'left',
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  switchLabelContainer: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#334155',
  },
  switchSubLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: '#0ea5e9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  }
});
