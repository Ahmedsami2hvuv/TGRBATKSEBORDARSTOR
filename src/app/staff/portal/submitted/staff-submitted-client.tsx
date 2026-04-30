"use client";

import { UnifiedOrderListTable } from "@/components/unified-order-list-table";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import Link from "next/link";

export function StaffSubmittedClient({
  rows,
  authQ,
}: {
  rows: MandoubRow[];
  authQ: string;
}) {
  return (
    <div className="space-y-4">
      <UnifiedOrderListTable
        rows={rows}
        hideRegion
        onRowClick={(row) => {
          // التوجيه إلى صفحة تعديل المسودة أو عرض تفاصيلها
          window.location.href = `/staff/portal/submitted/${row.id}?${authQ}`;
        }}
      />
    </div>
  );
}
