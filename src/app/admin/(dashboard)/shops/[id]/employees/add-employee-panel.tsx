"use client";

import { useState } from "react";
import { ad } from "@/lib/admin-ui";
import { EmployeeForm } from "./employee-form";

export function AddEmployeePanel({ shopId }: { shopId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className={ad.btnPrimary}>
        إضافة عميل
      </button>

      {open ? (
        <section className={ad.section}>
          <h2 className={ad.h2}>إضافة عميل</h2>
          <div className="mt-4">
            <EmployeeForm shopId={shopId} submitLabel="إضافة عميل" successLabel="تمت إضافة العميل." />
          </div>
        </section>
      ) : null}
    </div>
  );
}

