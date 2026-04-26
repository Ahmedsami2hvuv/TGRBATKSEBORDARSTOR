"use client";

import { ad } from "@/lib/admin-ui";
import { deleteCustomerPhoneProfile } from "./actions";

export function CustomerProfileDeleteForm({ id }: { id: string }) {
  return (
    <form
      action={deleteCustomerPhoneProfile}
      onSubmit={(e) => {
        if (!confirm("حذف هذا السجل نهائياً؟")) e.preventDefault();
      }}
      className="mt-6 border-t border-rose-100 pt-4"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={ad.btnDanger}>
        حذف السجل من المرجع
      </button>
    </form>
  );
}
