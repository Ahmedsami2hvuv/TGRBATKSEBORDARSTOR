import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { buildShopStaffOrderShareMessage, whatsappMeUrl } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function ShopEmployeesPage(props: any) {
  try {
    const params = await props.params;
    const shopId = String(params?.id || "");

    if (!shopId) return notFound();

    // جلب بيانات المحل مع حماية الأعمدة
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        locationUrl: true,
        region: {
          select: { name: true }
        }
      }
    });

    if (!shop) return notFound();

    // جلب الموظفين مع اختيار الأعمدة الموجودة يقيناً في قاعدة البيانات
    // هذا يتجاوز خطأ "column lastEmployeeLat does not exist"
    const employees = await prisma.employee.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        orderPortalToken: true,
        createdAt: true
      }
    });

    const baseUrl = getPublicAppUrl();

    // دالة الحذف (Server Action)
    async function deleteAction(formData: FormData) {
      "use server";
      const id = String(formData.get("id") ?? "");
      const sId = String(formData.get("shopId") ?? "");
      if (id) {
        await prisma.employee.delete({ where: { id } });
        revalidatePath(`/admin/shops/${sId}/employees`);
      }
    }

    return (
      <div style={{ padding: "15px", maxWidth: "800px", margin: "0 auto", direction: "rtl", fontFamily: "sans-serif" }}>
        <div style={{ marginBottom: "20px" }}>
          <Link href="/admin/shops" style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: "bold" }}>← العودة للمحلات</Link>
        </div>

        <div style={{ background: "#1e293b", color: "white", padding: "25px", borderRadius: "15px", marginBottom: "25px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
          <h1 style={{ margin: 0, fontSize: "22px" }}>إدارة أصحاب الروابط</h1>
          <p style={{ margin: "8px 0 0 0", color: "#94a3b8" }}>المحل: <strong>{shop.name}</strong> | المنطقة: {shop.region?.name || "غير محددة"}</p>
        </div>

        <div style={{ background: "white", padding: "20px", borderRadius: "15px", border: "1px solid #e2e8f0", marginBottom: "25px" }}>
          <h3 style={{ marginTop: 0, fontSize: "16px" }}>إضافة حساب جديد</h3>
          <form action="/api/admin/employees/add" method="POST" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input type="hidden" name="shopId" value={shopId} />
            <input name="name" placeholder="اسم الموظف" required style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
            <input name="phone" placeholder="رقم الهاتف" required style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
            <button type="submit" style={{ background: "#0ea5e9", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>إضافة</button>
          </form>
        </div>

        <div style={{ background: "white", borderRadius: "15px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ padding: "15px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: "bold" }}>الموظفون المسجلون ({employees.length})</div>
          {employees.map((e) => {
            let portalUrl = "";
            let waLink = "#";
            try {
              portalUrl = buildEmployeeOrderPortalUrl(e.id, e.orderPortalToken, baseUrl);
              const msg = buildShopStaffOrderShareMessage({
                shopName: shop.name,
                locationUrl: shop.locationUrl || "",
                employeeName: e.name,
                orderPortalUrl: portalUrl
              });
              waLink = whatsappMeUrl(e.phone, msg);
            } catch(err) {}

            return (
              <div key={e.id} style={{ padding: "15px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "16px" }}>{e.name}</div>
                  <div style={{ color: "#64748b", fontSize: "13px" }}>{e.phone}</div>
                  <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                    <a href={waLink} style={{ background: "#22c55e", color: "white", padding: "5px 10px", borderRadius: "5px", textDecoration: "none", fontSize: "11px", fontWeight: "bold" }}>واتساب 💬</a>
                    <a href={portalUrl} target="_blank" style={{ background: "#f0f9ff", color: "#0369a1", padding: "5px 10px", borderRadius: "5px", textDecoration: "none", fontSize: "11px", fontWeight: "bold" }}>فتح الرابط 🔗</a>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Link href={`/admin/shops/${shopId}/employees/${e.id}/edit`} style={{ padding: "6px 12px", background: "#475569", color: "white", borderRadius: "6px", fontSize: "11px", textDecoration: "none" }}>تعديل</Link>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="shopId" value={shopId} />
                    <button type="submit" style={{ padding: "6px 12px", background: "#fee2e2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }} onClick={(v) => !confirm("حذف؟") && v.preventDefault()}>حذف</button>
                  </form>
                </div>
              </div>
            );
          })}
          {employees.length === 0 && <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>لا يوجد موظفون حالياً</div>}
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div style={{ padding: "30px", direction: "rtl", color: "red" }}>
        <h2>خطأ تقني:</h2>
        <pre style={{ background: "#eee", padding: "15px", borderRadius: "10px" }}>{err.message}</pre>
        <button onClick={() => window.location.reload()} style={{ padding: "10px 20px", cursor: "pointer" }}>إعادة المحاولة</button>
      </div>
    );
  }
}
