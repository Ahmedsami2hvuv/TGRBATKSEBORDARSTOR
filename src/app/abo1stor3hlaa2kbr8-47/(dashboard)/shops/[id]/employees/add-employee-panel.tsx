"use client";

import { useState } from "react";
import { ad } from "@/lib/admin-ui";
import { EmployeeForm } from "./employee-form";

export function AddEmployeePanel({ shopId }: { shopId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${ad.btnPrimary} w-full flex items-center justify-center gap-2 shadow-lg shadow-sky-200/50 py-3`}
      >
        {open ? "إغلاق النموذج" : "فتح نموذج الإضافة"}
      </button>

      {open ? (
        <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
          <EmployeeForm
            shopId={shopId}
            submitLabel="حفظ بيانات العميل"
            successLabel="تمت إضافة العميل بنجاح."
          />
        </div>
      ) : (
        <p className="text-[10px] text-sky-600/60 text-center font-medium">
          انقر أعلاه لإضافة موظف جديد لهذا المحل
        </p>
      )}
    </div>
  );
}

