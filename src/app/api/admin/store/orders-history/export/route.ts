import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin-session";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";

type StoreCartItem = {
  name?: string;
  line?: string;
  quantity?: number;
  qty?: number;
  price?: number | string;
  productId?: string;
  supplierId?: string | null;
};

function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseItems(data: unknown): StoreCartItem[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.webStoreCart)) return obj.webStoreCart as StoreCartItem[];
  if (Array.isArray(obj.products)) return obj.products as StoreCartItem[];
  return [];
}

function countSections(items: StoreCartItem[]): number {
  const keys = new Set<string>();
  for (const item of items) {
    const key = String(item.supplierId || item.productId || item.name || item.line || "").trim();
    if (key) keys.add(key);
  }
  return keys.size;
}

function computeTotal(items: StoreCartItem[]): number {
  let total = 0;
  for (const item of items) {
    const qty = Math.max(1, toNum(item.quantity ?? item.qty ?? 1));
    const price = toNum(item.price);
    total += price * qty;
  }
  return total;
}

function safeOrderNumber(data: unknown): string {
  if (!data || typeof data !== "object") return "—";
  const v = toNum((data as Record<string, unknown>).reservedOrderNumber);
  return v > 0 ? String(Math.trunc(v)) : "—";
}

function escapeCsv(v: string): string {
  const normalized = String(v ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const setting = await prisma.uISystemSetting.findUnique({
    where: { target_section: { target: "customer", section: "store_general" } },
  });
  const cfg = (setting?.config as Record<string, unknown> | null) || {};
  if (cfg.export_store_orders_excel_enabled === false) {
    return NextResponse.json({ error: "Excel export disabled from settings" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const minOrders = Math.max(1, toNum(url.searchParams.get("minOrders") || 1));

  const drafts = await prisma.companyPreparerShoppingDraft.findMany({
    where: {
      OR: [
        { titleLine: { contains: "المتجر", mode: "insensitive" } },
        { titleLine: { contains: "Store", mode: "insensitive" } },
      ],
    },
    include: { customerRegion: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const rows = drafts.map((d) => {
    const items = parseItems(d.data);
    const totalAmount = computeTotal(items);
    const dateLabel = formatBaghdadDateTime(d.createdAt, { dateStyle: "short", timeStyle: "short" });
    return {
      orderNumber: safeOrderNumber(d.data),
      regionName: d.customerRegion?.name || "—",
      customerPhone: (d.customerPhone || "").trim() || "—",
      sectionsCount: countSections(items),
      totalAmount,
      dateLabel,
      createdAtIso: d.createdAt.toISOString(),
    };
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.customerPhone === "—") continue;
    counts.set(row.customerPhone, (counts.get(row.customerPhone) ?? 0) + 1);
  }

  let filtered = rows.filter((r) => (counts.get(r.customerPhone) ?? 0) >= minOrders);
  if (q) {
    filtered = filtered.filter((r) => {
      const hay = [
        r.orderNumber,
        r.regionName,
        r.customerPhone,
        String(r.totalAmount),
        r.dateLabel,
        r.createdAtIso.slice(0, 10),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const header = [
    "رقم الطلب",
    "اسم المنطقة",
    "رقم الزبون",
    "عدد الاقسام",
    "سعر الطلب الكلي",
    "تاريخ الطلب",
    "عدد طلبات الزبون",
  ];

  const lines = [header.map(escapeCsv).join(",")];
  for (const r of filtered) {
    lines.push(
      [
        r.orderNumber,
        r.regionName,
        r.customerPhone,
        String(r.sectionsCount),
        String(r.totalAmount / 1000),
        r.dateLabel,
        String(counts.get(r.customerPhone) ?? 0),
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  const csv = `\uFEFF${lines.join("\n")}`;
  const now = new Date();
  const filename = `store-orders-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
