const fs = require('fs');
const path = require('path');
const root = process.cwd();
const files = [
  {file: 'src/app/admin/(dashboard)/reports/page.tsx', title: 'التقارير — تحت المراجعة', heading: 'قسم التقارير مغلق مؤقتاً'},
  {file: 'src/app/admin/(dashboard)/reports/orders/page.tsx', title: 'تقرير الطلبات — تحت المراجعة', heading: 'صفحة تقرير الطلبات مغلقة مؤقتاً'},
  {file: 'src/app/admin/(dashboard)/reports/general/page.tsx', title: 'التقرير العام — تحت المراجعة', heading: 'صفحة التقرير العام مغلقة مؤقتاً'},
  {file: 'src/app/admin/(dashboard)/reports/wallet-ledger/page.tsx', title: 'مستودع معاملات المحافظ — تحت المراجعة', heading: 'صفحة مستودع معاملات المحافظ مغلقة مؤقتاً'},
  {file: 'src/app/admin/(dashboard)/reports/couriers/page.tsx', title: 'تقرير المندوبين — تحت المراجعة', heading: 'صفحة تقرير المندوبين مغلقة مؤقتاً'},
  {file: 'src/app/admin/(dashboard)/reports/preparers/page.tsx', title: 'طلبات موظفي المحل — تحت المراجعة', heading: 'صفحة طلبات موظفي المحل مغلقة مؤقتاً'},
  {file: 'src/app/admin/(dashboard)/reports/preparation/page.tsx', title: 'تقرير التجهيز — تحت المراجعة', heading: 'صفحة تقرير التجهيز مغلقة مؤقتاً'},
  {file: 'src/app/admin/(dashboard)/reports/shops/page.tsx', title: 'تقرير المحلات — تحت المراجعة', heading: 'صفحة تقرير المحلات مغلقة مؤقتاً'},
  {file: 'src/app/admin/(dashboard)/reports/courier-mandoub/page.tsx', title: 'لوحة المندوب — تحت المراجعة', heading: 'صفحة لوحة المندوب مغلقة مؤقتاً'},
  {file: 'src/app/admin/(dashboard)/reports/accounting/page.tsx', title: 'ربط المحاسبة — تحت المراجعة', heading: 'صفحة ربط المحاسبة مغلقة مؤقتاً'},
];
const message = 'تم تفريغ نظام التقارير الحالي ليتم إعادة تنظيمه لاحقاً. لا توجد بيانات أو روابط للتقارير ضمن هذا القسم حالياً.';
for (const item of files) {
  const filePath = path.join(root, item.file);
  if (!fs.existsSync(filePath)) {
    console.error('missing file', filePath);
    continue;
  }
  const content = `import Link from "next/link";
import { ad } from "@/lib/admin-ui";

export const metadata = {
  title: "${item.title}",
};

export default function ReportsPlaceholderPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>{"${item.heading}"}</h1>
        <p className={`mt-3 ${ad.lead}`}>
          ${message}
        </p>
      </div>
    </div>
  );
}
`;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('updated', item.file);
}
console.log('report page placeholders written');
