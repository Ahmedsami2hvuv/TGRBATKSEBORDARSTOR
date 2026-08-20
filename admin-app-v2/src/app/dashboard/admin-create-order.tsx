import React, { useState } from 'react';
import { 
  StyleSheet, View, Text, ScrollView, TouchableOpacity, 
  TextInput, SafeAreaView, Platform, StatusBar 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AdminCreateOrderScreen() {
  const router = useRouter();

  const [assignedCourier, setAssignedCourier] = useState('none');
  const [routeType, setRouteType] = useState('single');
  const [deliveryCost, setDeliveryCost] = useState('0');

  const couriers = [
    { id: 'none', label: 'بدون إسناد', subLabel: '(طلبات جديدة)' },
    { id: 'abdullah', label: 'عبد الله', subLabel: 'إسناد مباشر' },
    { id: 'boos', label: 'boos', subLabel: 'إسناد مباشر' },
    { id: 'mojtaba', label: 'مجتبى', subLabel: 'إسناد مباشر' },
    { id: 'fares', label: 'فارس', subLabel: 'إسناد مباشر' },
    { id: 'najem', label: 'نجم', subLabel: 'إسناد مباشر' },
  ];

  const quickItemTypes = ['طابعة', 'اقمشة', 'روبيان 2كيس', 'سمتي 1ك ونص', 'روبيان و حمره'];
  const quickPrices = ['22', '8.25', '11', '14', '15'];
  const quickTimes = ['هسه', 'فوري', 'الان'];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
          <Text style={styles.backText}>الرجوع إلى الطلبات الجديدة</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>إضافة طلب من الإدارة</Text>
          <Text style={styles.subTitle}>خيارات متعددة: رفع من محل، وجهة واحدة، وجهتان، أو طلب تجهيز (تحليل رسالة).</Text>
        </View>

        {/* Couriers Grid */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={20} color="#0ea5e9" />
            <Text style={styles.cardTitle}>إسناد مباشر لمندوب <Text style={styles.badgeText}>إسناد فوري</Text></Text>
          </View>
          <View style={styles.couriersGrid}>
            {couriers.map((courier) => {
              const isSelected = assignedCourier === courier.id;
              return (
                <TouchableOpacity
                  key={courier.id}
                  style={[styles.courierBtn, isSelected && styles.courierBtnSelected]}
                  onPress={() => setAssignedCourier(courier.id)}
                >
                  <Text style={[styles.courierLabel, isSelected && styles.courierLabelSelected]}>{courier.label}</Text>
                  <Text style={[styles.courierSubLabel, isSelected && styles.courierLabelSelected]}>{courier.subLabel}</Text>
                  {isSelected && (
                    <View style={styles.checkIcon}>
                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hintText}>*إذا اخترت مندوب، سيتم إرسال إشعار فوري له وسينتقل الطلب لحالة "قيد التوصيل".</Text>
        </View>

        {/* Route Type */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>نوع المسار / الطلب</Text>
          
          <TouchableOpacity style={styles.radioRow} onPress={() => setRouteType('single')}>
            <View style={[styles.radioCircle, routeType === 'single' && styles.radioCircleSelected]} />
            <Text style={styles.radioText}><Text style={styles.boldText}>وجهة واحدة (إداري)</Text> - طلبية مباشرة بدون محل.</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.radioRow} onPress={() => setRouteType('double')}>
            <View style={[styles.radioCircle, routeType === 'double' && styles.radioCircleSelected]} />
            <Text style={styles.radioText}><Text style={styles.boldText}>وجهتان</Text> - مرسل ومستلم (رقم ومنطقة لكل وجهة).</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.radioRow} onPress={() => setRouteType('shop')}>
            <View style={[styles.radioCircle, routeType === 'shop' && styles.radioCircleSelected]} />
            <Text style={styles.radioText}><Text style={styles.boldText}>رفع من محل</Text> - ابحث عن المحل، ثم اختر العميل كزر جاهز أو "الإدارة".</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.radioRow} onPress={() => setRouteType('prepare')}>
            <View style={[styles.radioCircle, routeType === 'prepare' && styles.radioCircleSelected]} />
            <Text style={styles.radioText}><Text style={[styles.boldText, {color:'#a855f7'}]}>طلب تجهيز (تحليل رسالة)</Text> - إرسال مسودة تسوق للمجهزين من خلال نص رسالة.</Text>
          </TouchableOpacity>
        </View>

        {/* Main Form Fields */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionNotice}>وجهة واحدة: لا يتطلب اختيار محل. أدخل تفاصيل الزبون ونوع الطلبية والسعر.</Text>
          
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>رقم الزبون</Text>
            <TextInput style={styles.input} placeholder="اكتب أو الصق الرقم" placeholderTextColor="#94a3b8" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>منطقة الزبون</Text>
            <TextInput style={styles.input} placeholder="ابحث عن المنطقة..." placeholderTextColor="#94a3b8" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>نوع الطلب</Text>
            <View style={styles.quickTags}>
              {quickItemTypes.map((item, i) => (
                <TouchableOpacity key={i} style={styles.tagBtn}>
                  <Text style={styles.tagText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="مثال: مستلزمات" placeholderTextColor="#94a3b8" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>سعر الشراء (للمحل/السوق)</Text>
            <TextInput style={styles.input} placeholder="مثال: 15" placeholderTextColor="#94a3b8" keyboardType="numeric" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>سعر البيع (للزبون)</Text>
            <View style={styles.quickTags}>
              {quickPrices.map((price, i) => (
                <TouchableOpacity key={i} style={styles.tagBtnPrice}>
                  <Text style={styles.tagTextPrice}>{price}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="اكتب السعر" placeholderTextColor="#94a3b8" keyboardType="numeric" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>كلفة التوصيل</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterBtnRed} onPress={() => setDeliveryCost(String(Math.max(0, Number(deliveryCost)-1)))}>
                <Text style={styles.counterBtnTextRed}>-</Text>
              </TouchableOpacity>
              <TextInput 
                style={styles.counterInput} 
                value={deliveryCost} 
                onChangeText={setDeliveryCost} 
                keyboardType="numeric" 
                textAlign="center"
              />
              <TouchableOpacity style={styles.counterBtnGreen} onPress={() => setDeliveryCost(String(Number(deliveryCost)+1))}>
                <Text style={styles.counterBtnTextGreen}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.rowButtons}>
            <TouchableOpacity style={styles.flexBtn}>
              <Text style={styles.flexBtnText}>طلب عكسي</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.flexBtn}>
              <Text style={styles.flexBtnText}>واصل كلشي</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>وقت الطلب (إجباري)</Text>
            <View style={styles.quickTags}>
              {quickTimes.map((time, i) => (
                <TouchableOpacity key={i} style={styles.tagBtn}>
                  <Text style={styles.tagText}>{time}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="مثال: الان" placeholderTextColor="#94a3b8" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>أقرب نقطة دالة</Text>
            <TextInput style={styles.input} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>لوكيشن الزبون</Text>
            <TextInput style={styles.input} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>صورة الطلب</Text>
            <TouchableOpacity style={styles.filePicker}>
              <Text style={styles.filePickerText}>اختيار ملف ... لم يتم اختيار أي ملف</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>ملاحظة صوتية</Text>
            <TouchableOpacity style={styles.audioBtn}>
              <Ionicons name="mic" size={20} color="#be123c" />
              <Text style={styles.audioBtnText}>تسجيل صوتي</Text>
            </TouchableOpacity>
            <Text style={styles.hintTextRight}>أقصى مدة 10 ثوان. يُرفع مع الطلب ويستمع له المندوب والإدارة.</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>رقم الزبون الثاني</Text>
            <TextInput style={styles.input} placeholder="رقم إضافي..." placeholderTextColor="#94a3b8" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>ملاحظات / تفاصيل (كتابية)</Text>
            <TextInput style={[styles.input, styles.textArea]} multiline numberOfLines={4} />
          </View>

        </View>

      </ScrollView>

      {/* Footer Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitBtn}>
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.submitBtnText}>إنشاء الطلب</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  titleSection: {
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 6,
    textAlign: 'right'
  },
  subTitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'right'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'right',
    marginRight: 8,
    flexDirection: 'row-reverse'
  },
  badgeText: {
    fontSize: 12,
    color: 'white',
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 6
  },
  couriersGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  courierBtn: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    position: 'relative'
  },
  courierBtnSelected: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  courierLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  courierLabelSelected: {
    color: '#047857',
  },
  courierSubLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  hintText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 4,
    fontStyle: 'italic'
  },
  radioRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginLeft: 12,
  },
  radioCircleSelected: {
    borderColor: '#0ea5e9',
    backgroundColor: '#0ea5e9',
    borderWidth: 6,
  },
  radioText: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
    textAlign: 'right'
  },
  boldText: {
    fontWeight: 'bold',
    color: '#0f172a'
  },
  formContainer: {
    backgroundColor: 'transparent',
  },
  sectionNotice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4338ca',
    textAlign: 'right',
    backgroundColor: '#e0e7ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    overflow: 'hidden'
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'right',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    textAlign: 'right',
    color: '#0f172a'
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  quickTags: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tagBtn: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#0ea5e9',
    fontWeight: '600',
    fontSize: 13,
  },
  tagBtnPrice: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    marginBottom: 8,
  },
  tagTextPrice: {
    color: '#059669',
    fontWeight: 'bold',
    fontSize: 14,
  },
  counterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterBtnRed: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    width: 60,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnTextRed: {
    color: '#ef4444',
    fontSize: 24,
    fontWeight: 'bold',
  },
  counterInput: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    height: 50,
    marginHorizontal: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  counterBtnGreen: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    width: 60,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnTextGreen: {
    color: '#10b981',
    fontSize: 24,
    fontWeight: 'bold',
  },
  rowButtons: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  flexBtn: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  flexBtnText: {
    color: '#334155',
    fontWeight: 'bold',
    fontSize: 15,
  },
  filePicker: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  filePickerText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600'
  },
  audioBtn: {
    flexDirection: 'row-reverse',
    backgroundColor: '#ffe4e6',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: 20
  },
  audioBtnText: {
    color: '#be123c',
    fontWeight: 'bold',
    fontSize: 15,
    marginRight: 8,
  },
  hintTextRight: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  submitBtn: {
    backgroundColor: '#7dd3fc',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  }
});
