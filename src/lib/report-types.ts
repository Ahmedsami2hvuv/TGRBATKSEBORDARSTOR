export type ReportTableRow = {
  orderId: string;
  orderNumber: number;
  /** لون صف الجدول حسب حالة الطلب */
  status: string;
  shopName: string;
  preparerName: string;
  courierName: string;
  transactionType: string;
  amount: string;
  dateLabel: string;
  /** true عندما لا يوجد رابط لوكيشن على الطلب ولا على سجل العميل */
  missingCustomerLocation: boolean;
};
