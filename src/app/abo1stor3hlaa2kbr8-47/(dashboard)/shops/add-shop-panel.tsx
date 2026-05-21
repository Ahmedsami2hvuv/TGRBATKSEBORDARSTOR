"use client";

import { useState } from "react";
import { ad } from "@/lib/admin-ui";
import { ShopForm } from "./shop-form";
import type { AdminRegionOption } from "@/components/admin-region-search-picker";
import { GlobalIconsConfig } from "@/lib/icon-settings";

export function AddShopPanel({ regions, icons }: { regions: AdminRegionOption[]; icons: GlobalIconsConfig | null }) {
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
            <ShopForm regions={regions} icons={icons} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

