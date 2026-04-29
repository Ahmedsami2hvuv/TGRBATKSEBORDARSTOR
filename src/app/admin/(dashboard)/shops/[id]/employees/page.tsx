import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { buildShopStaffOrderShareMessage, whatsappMeUrl } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";

// إعداد الصفحة لتكون ديناميكية بالكامل
export const dynamic = "force-dynamic";

export default async function ShopEmployeesPage(props: any) {
  try {
    const params = await props.params;
    const shopId = String(params?.id || "");

    if (!shopId) return notFound();

    // جلب البيانات
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: { region: true },
    });

    if (!shop) return notFound();

    const employees = await prisma.employee.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      // حل جذري: جلب الأعمدة الموجودة فقط وتجاهل الأعمدة المفقودة في قاعدة البيانات
      select: {
        id: true,
        name: true,
        phone: true,
        orderPortalToken: true,
        createdAt: true,
      }
    });

    const baseUrl = getPublicAppUrl();

    // دالة حذف الموظف (Server Action داخل الملف لضمان الاستقرار)
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
      <div style={{ padding: "20px", fontFamily: "sans-serif", direction: "rtl" }}>
        {/* رابط العودة */}
        <div style={{ marginBottom: "20px" }}>
          <Link href="/admin/shops" style={{ color: "#0284c7", fontWeight: "bold", textDecoration: "none" }}>
            ← العودة لقائمة المحلات
          </Link>
        </div>

        {/* كارت معلومات المحل */}
        <div style={{ background: "#0f172a", color: "white", padding: "30px", borderRadius: "20px", marginBottom: "30px" }}>
          <h1 style={{ margin: 0, fontSize: "24px" }}>إدارة موظفي المحل</h1>
          <p style={{ margin: "10px 0 0 0", color: "#94a3b8" }}>
            المحل: <strong style={{ color: "white" }}>{shop.name}</strong> | المنطقة: {shop.region?.name || "غير محددة"}
          </p>
        </div>

        {/* نموذج إضافة سريع */}
        <div style={{ background: "white", padding: "20px", borderRadius: "15px", border: "1px solid #e2e8f0", marginBottom: "30px" }}>
          <h3 style={{ marginTop: 0 }}>إضافة حساب جديد</h3>
          <form action="/api/admin/employees/add" method="POST" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input type="hidden" name="shopId" value={shopId} />
            <input name="name" placeholder="الاسم" required style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ddd", flex: 1 }} />
            <input name="phone" placeholder="رقم الواتساب" required style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ddd", flex: 1 }} />
            <button type="submit" style={{ background: "#0284c7", color: "white", padding: "10px 20px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer" }}>
              إضافة الحساب
            </button>
          </form>
        </div>

        {/* قائمة الموظفين */}
        <div style={{ background: "white", borderRadius: "15px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ padding: "15px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <h2 style={{ margin: 0, fontSize: "18px" }}>المسجلين حالياً ({employees.length})</h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
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
                <div key={e.id} style={{ padding: "20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: "bold" }}>{e.name}</div>
                    <div style={{ color: "#64748b", fontSize: "14px" }}>{e.phone}</div>
                    <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
                      <a href={waLink} style={{ background: "#16a34a", color: "white", padding: "6px 12px", borderRadius: "6px", textDecoration: "none", fontSize: "12px", fontWeight: "bold" }}> إرسال الرابط (واتساب) 💬</a>
                      <a href={portalUrl} target="_blank" style={{ background: "#e0f2fe", color: "#0369a1", padding: "6px 12px", borderRadius: "6px", textDecoration: "none", fontSize: "12px", fontWeight: "bold" }}> فتح الرابط 🔗</a>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <Link href={`/admin/shops/${shopId}/employees/${e.id}/edit`} style={{ padding: "8px 15px", background: "#334155", color: "white", borderRadius: "8px", textDecoration: "none", fontSize: "12px" }}>تعديل</Link>
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="shopId" value={shopId} />
                      <button type="submit" style={{ padding: "8px 15px", background: "#fee2e2", color: "#dc2626", borderRadius: "8px", border: "1px solid #fecaca", fontSize: "12px", cursor: "pointer" }} onClick={(ev) => { if(!confirm("حذف؟")) ev.preventDefault(); }}>حذف</button>
                    </form>
                  </div>
                </div>
              );
            })}
            {employees.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>لا يوجد موظفين حالياً</div>}
          </div>
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div style={{ padding: "40px", color: "red", direction: "rtl" }}>
        <h1>حدث خطأ في عرض الصفحة</h1>
        <pre>{error.message}</pre>
      </div>
    );
  }
}
