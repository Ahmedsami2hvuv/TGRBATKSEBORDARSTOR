import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { EmployeeEditForm } from "./edit-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; employeeId: string }>;
};

export default async function EditEmployeePage({ params }: Props) {
  const { id: shopId, employeeId } = await params;
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
    include: { shop: true },
  });
  if (!employee) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link
          href={`/admin/shops/${shopId}/employees`}
          className={ad.link}
        >
          ← موظفو المحل
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>تعديل موظف</h1>
        <p className={`mt-1 ${ad.lead}`}>{employee.shop.name}</p>
      </div>
      <section className={ad.section}>
        <EmployeeEditForm
          shopId={shopId}
          employeeId={employee.id}
          defaultName={employee.name}
          defaultPhone={employee.phone}
        />
      </section>
    </div>
  );
}
