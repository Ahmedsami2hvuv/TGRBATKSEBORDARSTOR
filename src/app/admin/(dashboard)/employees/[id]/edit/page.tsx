import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { updateStaffEmployeeForm } from "../../actions";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StaffEmployeeEditPage({ params }: Props) {
  const { id } = await params;
  const [emp, icons] = await Promise.all([
    prisma.staffEmployee.findUnique({
      where: { id },
      include: { managedBranches: true }
    }),
    getGlobalIcons()
  ]);

  if (!emp) notFound();

  const branches = await prisma.storeBranch.findMany({
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/admin/employees" className={`${ad.link} flex items-center gap-1`}>
          <DynamicIcon iconKey="ui_arrow_right" config={icons} fallback="←" className="w-3 h-3" />
          الموظفين
        </Link>
      </p>

      <header className={ad.section}>
        <h1 className={ad.h1}>تعديل الموظف</h1>
        <p className={ad.lead}>{emp.name}</p>
      </header>

      <section className={ad.section}>
        <form action={updateStaffEmployeeForm} className="max-w-xl space-y-6">
          <input type="hidden" name="id" value={emp.id} />

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">المعلومات الأساسية</h2>
            <label className="block">
              <span className={ad.label}>الاسم *</span>
              <input name="name" defaultValue={emp.name} required className={ad.input} />
            </label>
            <label className="block">
              <span className={ad.label}>الهاتف</span>
              <input name="phone" defaultValue={emp.phone} className={ad.input} />
            </label>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">الصلاحيات</h2>

            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition">
              <input type="checkbox" name="canSubmitOrders" defaultChecked={emp.canSubmitOrders} className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500" />
              <div>
                <p className="font-bold text-slate-800 text-sm">رفع طلبات تجهيز</p>
                <p className="text-xs text-slate-500">يسمح للموظف بإنشاء طلبات جديدة للمناديب.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition">
              <input type="checkbox" name="canViewArchived" defaultChecked={emp.canViewArchived} className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500" />
              <div>
                <p className="font-bold text-slate-800 text-sm">فتح الطلبات المؤرشفة</p>
                <p className="text-xs text-slate-500">يسمح للموظف بمشاهدة سجل الطلبات القديمة.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition">
              <input type="checkbox" name="canManageStore" defaultChecked={emp.canManageStore} className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500" />
              <div>
                <p className="font-bold text-slate-800 text-sm">إدارة المتجر</p>
                <p className="text-xs text-slate-500">يسمح للموظف بإدارة الأقسام، الأفرع، والمنتجات.</p>
              </div>
            </label>
          </div>

          {emp.canManageStore && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">الأفرع المدارة</h2>
              <p className="text-xs text-slate-500 mb-3">اختر الأفرع التي يمكن لهذا الموظف إدارتها:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {branches.map(branch => (
                  <label key={branch.id} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      name="managedBranchIds"
                      value={branch.id}
                      defaultChecked={emp.managedBranches.some(b => b.id === branch.id)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium">{branch.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4">
            <button type="submit" className={`${ad.btnDark} w-full py-3 text-lg`}>
              حفظ التعديلات
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

