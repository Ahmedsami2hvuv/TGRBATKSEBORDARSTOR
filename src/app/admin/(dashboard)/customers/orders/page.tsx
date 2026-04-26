import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { normalizeAdminShopName } from "@/lib/admin-order-from-admin-constants";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { CustomerOrdersBulkTable } from "./customer-orders-bulk-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "طلبات الزبون — أبو الأكبر للتوصيل",
};

type Props = { searchParams: Promise<{ phone?: string }> };

export default async function CustomerPhoneOrdersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const phone = (sp.phone ?? "").trim();
  if (!phone) {
    redirect("/admin/customers");
  }

  const [orders, couriers] = await Promise.all([
    prisma.order.findMany({
      where: { customerPhone: phone },
      orderBy: [{ createdAt: "asc" }, { orderNumber: "asc" }],
      include: {
        shop: true,
        courier: true,
        customer: { select: { customerLocationUrl: true, name: true } },
      },
    }),
    prisma.courier.findMany({
      where: courierAssignableWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/customers" className={ad.link}>
          ← بيانات الزبائن
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin" className={ad.link}>
          الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>طلبات هذا الرقم</h1>
        <p className={`mt-1 ${ad.lead}`}>
          الهاتف:{" "}
          <strong className="font-mono tabular-nums text-sky-900">{phone}</strong>
          {" — "}
          جميع الطلبات المسجّلة لهذا الرقم{" "}
          <strong className="text-sky-800">بالترتيب الزمني</strong> (من الأقدم إلى الأحدث).
        </p>
        <p className="mt-2 text-sm">
          <Link
            href={`/admin/customers/info?phone=${encodeURIComponent(phone)}`}
            className={ad.link}
          >
            ← العودة إلى معلومات الزبون (المناطق والمرجعية)
          </Link>
        </p>
      </div>

      {orders.length === 0 ? (
        <div className={`${ad.section} border-dashed border-sky-300`}>
          <p className="text-center text-slate-600">
            لا توجد طلبات لهذا الرقم في النظام.
          </p>
          <p className="mt-2 text-center">
            <Link href="/admin/orders/tracking" className={ad.link}>
              البحث في تتبع الطلبات
            </Link>
          </p>
        </div>
      ) : (
        <CustomerOrdersBulkTable
          orders={orders.map((o) => {
            const missingLoc = !hasCustomerLocationUrl(
              o.customerLocationUrl,
              o.customer?.customerLocationUrl,
            );
            return {
              id: o.id,
              orderNumber: o.orderNumber,
              createdAtLabel: o.createdAt.toLocaleString("ar-IQ-u-nu-latn", {
                dateStyle: "medium",
                timeStyle: "short",
              }),
              shopName: normalizeAdminShopName(o.shop.name),
              status: o.status,
              missingLoc,
              totalLabel: o.orderSubtotal != null ? formatDinarAsAlf(o.orderSubtotal) : "—",
              courierName: o.courier?.name?.trim() || "",
            };
          })}
          couriers={couriers}
        />
      )}

      <p className={ad.orderListCountFooter}>
        عدد الطلبات في هذه الصفحة:{" "}
        <span className="font-bold text-sky-900">{orders.length}</span>
      </p>

      <p className={`text-sm ${ad.muted}`}>
        للبحث الأوسع (رقم طلب، محل، مندوب…) استخدم{" "}
        <Link href="/admin/orders/tracking" className={ad.link}>
          تتبع الطلبات
        </Link>
        .
      </p>
    </div>
  );
}
