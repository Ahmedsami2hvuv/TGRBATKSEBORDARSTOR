"use client";

import { useState } from "react";
import { ad } from "@/lib/admin-ui";
import { ShopForm } from "./shop-form";
import type { AdminRegionOption } from "@/components/admin-region-search-picker";

export function AddShopPanel({ regions }: { regions: AdminRegionOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className={ad.btnPrimary}>
        إضافة محل
      </button>

      {open ? (
        <section className={ad.section}>
          <h2 className={ad.h2}>إضافة محل</h2>
          <div className="mt-4">
            <ShopForm regions={regions} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

