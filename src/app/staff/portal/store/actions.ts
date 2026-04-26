"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";

export type StaffStoreActionState = { error?: string; ok?: boolean; id?: string };

async function validateStaffStoreAccess(formData: FormData, branchId?: string) {
  const se = String(formData.get("se") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");

  const v = verifyStaffEmployeePortalQuery(se, exp, s);
  if (!v.ok) throw new Error("Unauthorized: Invalid link");

  const emp = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
    include: { managedBranches: branchId ? { where: { id: branchId } } : true }
  });

  if (!emp || !emp.active || !emp.canManageStore) {
    throw new Error("Unauthorized: Insufficient permissions");
  }

  if (branchId && emp.managedBranches.length === 0) {
    throw new Error("Unauthorized: You don't manage this branch");
  }

  return { emp, authQ: `se=${se}&exp=${exp}&s=${s}` };
}

export async function createStaffCategory(_prev: StaffStoreActionState, formData: FormData): Promise<StaffStoreActionState> {
  try {
    const branchId = String(formData.get("branchId") ?? "");
    const { authQ } = await validateStaffStoreAccess(formData, branchId);

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "الاسم مطلوب" };

    const cat = await prisma.storeCategory.create({
      data: {
        name,
        branchId,
        order: 0,
      }
    });

    revalidatePath(`/staff/portal/store/branches/${branchId}`);
    return { ok: true, id: cat.id };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function createStaffProduct(_prev: StaffStoreActionState, formData: FormData): Promise<StaffStoreActionState> {
  try {
    const branchId = String(formData.get("branchId") ?? "");
    const { authQ } = await validateStaffStoreAccess(formData, branchId);

    const name = String(formData.get("name") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "");
    const price = Number(formData.get("price") ?? 0);

    if (!name || !categoryId) return { error: "الاسم والقسم مطلوبان" };

    const product = await prisma.storeProduct.create({
      data: {
        name,
        categoryId,
        branchId,
        basePrice: price,
        active: true,
      }
    });

    revalidatePath(`/staff/portal/store/branches/${branchId}`);
    return { ok: true, id: product.id };
  } catch (e: any) {
    return { error: e.message };
  }
}
