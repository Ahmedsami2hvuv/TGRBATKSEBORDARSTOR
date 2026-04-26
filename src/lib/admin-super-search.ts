import { Prisma } from "@prisma/client";
import { formatDinarAsAlfWithUnit, normalizeDigits } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ADMIN_TILES, tileHref } from "@/lib/admin-nav";
import { normalizeAdminShopName } from "@/lib/admin-order-from-admin-constants";

type Scope =
  | "all"
  | "orders"
  | "customers"
  | "shops"
  | "couriers"
  | "settings"
  | "employees"
  | "preparers";

export type AdminSuperSearchParams = {
  q: string;
  scope: Scope;
  days: number | null;
  status: string;
  courierId: string;
  minAmount: number | null;
  maxAmount: number | null;
};

export type AdminSuperSearchResult = {
  orders: Array<{
    id: string;
    orderNumber: number;
    status: string;
    shopName: string;
    customerPhone: string;
    summary: string;
    orderType: string;
    totalAmount: string;
    createdAtIso: string;
  }>;
  customers: Array<{
    id: string;
    name: string;
    phone: string;
    alternatePhone: string;
    shopName: string;
    regionName: string;
    landmark: string;
  }>;
  shops: Array<{
    id: string;
    name: string;
    ownerName: string;
    phone: string;
    regionName: string;
  }>;
  couriers: Array<{
    id: string;
    name: string;
    phone: string;
  }>;
  employees: Array<{
    id: string;
    name: string;
    phone: string;
    shopName: string;
  }>;
  companyPreparers: Array<{
    id: string;
    name: string;
    phone: string;
    notes: string;
  }>;
  regions: Array<{
    id: string;
    name: string;
    deliveryPrice: string;
  }>;
  settings: Array<{
    label: string;
    href: string;
    reason: string;
  }>;
};

function includesScope(scope: Scope, target: Exclude<Scope, "all">): boolean {
  return scope === "all" || scope === target;
}

function parseOrderNumberCandidate(q: string): number | null {
  const digits = normalizeDigits(q.trim());
  if (!/^[0-9]+$/.test(digits)) return null;
  const n = Number(digits);
  // حقل orderNumber في PostgreSQL (Int) يدعم حتى 2,147,483,647
  if (!Number.isSafeInteger(n) || n < 0 || n > 2147483647) return null;
  return n;
}

/** كلمات واجهة المستخدم لطريقة التوصيل — غير مخزّنة كنص في orderType */
export function routeModeOrFromQuery(q: string): Array<{ routeMode: string }> {
  const t = q.trim();
  if (!t) return [];
  const out: Array<{ routeMode: string }> = [];
  if (t.includes("وجهتين")) {
    out.push({ routeMode: "double" });
  }
  if (t.includes("وجهة واحدة")) {
    out.push({ routeMode: "single" });
  }
  if (/^double$/i.test(t)) {
    out.push({ routeMode: "double" });
  }
  if (/^single$/i.test(t)) {
    out.push({ routeMode: "single" });
  }
  return out;
}

export async function runAdminSuperSearch(
  params: AdminSuperSearchParams,
): Promise<AdminSuperSearchResult> {
  const q = params.q.trim();
  if (!q) {
    return {
      orders: [],
      customers: [],
      shops: [],
      couriers: [],
      employees: [],
      companyPreparers: [],
      regions: [],
      settings: [],
    };
  }

  const orderNumberCandidate = parseOrderNumberCandidate(q);
  const routeModeOr = routeModeOrFromQuery(q);
  const qDigits = normalizeDigits(q);
  const daysStart =
    params.days && params.days > 0
      ? new Date(Date.now() - params.days * 24 * 60 * 60 * 1000)
      : null;

  let orderJsonMatchIds: string[] = [];
  if (q.length >= 2) {
    orderJsonMatchIds = (
      await prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT id FROM "Order"
          WHERE "preparerShoppingJson" IS NOT NULL
            AND strpos(lower("preparerShoppingJson"::text), lower(${q})) > 0
          LIMIT 120
        `,
      )
    ).map((r) => r.id);
  }

  const orderOrFilters: Prisma.OrderWhereInput[] = [
    ...(orderNumberCandidate != null
      ? [{ orderNumber: orderNumberCandidate }]
      : []),
    ...routeModeOr,
    ...(orderJsonMatchIds.length > 0 ? [{ id: { in: orderJsonMatchIds } }] : []),
    { id: { contains: q, mode: "insensitive" } },
    { summary: { contains: q, mode: "insensitive" } },
    { orderType: { contains: q, mode: "insensitive" } },
    { adminOrderCode: { contains: q, mode: "insensitive" } },
    { submissionSource: { contains: q, mode: "insensitive" } },
    { customerPhone: { contains: q, mode: "insensitive" } },
    ...(qDigits ? [{ customerPhone: { contains: qDigits, mode: "insensitive" } }] : []),
    { alternatePhone: { contains: q, mode: "insensitive" } },
    ...(qDigits ? [{ alternatePhone: { contains: qDigits, mode: "insensitive" } }] : []),
    { secondCustomerPhone: { contains: q, mode: "insensitive" } },
    ...(qDigits ? [{ secondCustomerPhone: { contains: qDigits, mode: "insensitive" } }] : []),
    { customerLandmark: { contains: q, mode: "insensitive" } },
    { secondCustomerLandmark: { contains: q, mode: "insensitive" } },
    { orderNoteTime: { contains: q, mode: "insensitive" } },
    { shop: { name: { contains: q, mode: "insensitive" } } },
    { customerRegion: { name: { contains: q, mode: "insensitive" } } },
    { secondCustomerRegion: { name: { contains: q, mode: "insensitive" } } },
    { courier: { name: { contains: q, mode: "insensitive" } } },
    {
      submittedBy: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
    },
    {
      submittedByCompanyPreparer: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
        ],
      },
    },
  ];

  const orders = includesScope(params.scope, "orders")
    ? await prisma.order.findMany({
        where: {
          AND: [
            daysStart ? { createdAt: { gte: daysStart } } : {},
            params.status ? { status: params.status } : {},
            params.courierId ? { assignedCourierId: params.courierId } : {},
            params.minAmount != null
              ? { totalAmount: { gte: params.minAmount } }
              : {},
            params.maxAmount != null
              ? { totalAmount: { lte: params.maxAmount } }
              : {},
            { OR: orderOrFilters },
          ],
        },
        include: {
          shop: { select: { name: true } },
          submittedBy: { select: { name: true, phone: true } },
          submittedByCompanyPreparer: {
            select: { name: true, phone: true, notes: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
      })
    : [];

  const customerOrFilters: Prisma.CustomerWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
    { phone: { contains: q, mode: "insensitive" } },
    ...(qDigits ? [{ phone: { contains: qDigits, mode: "insensitive" } }] : []),
    { alternatePhone: { contains: q, mode: "insensitive" } },
    ...(qDigits
      ? [{ alternatePhone: { contains: qDigits, mode: "insensitive" } }]
      : []),
    { customerLandmark: { contains: q, mode: "insensitive" } },
    { shop: { name: { contains: q, mode: "insensitive" } } },
    { customerRegion: { name: { contains: q, mode: "insensitive" } } },
  ];

  const customers = includesScope(params.scope, "customers")
    ? await prisma.customer.findMany({
        where: { OR: customerOrFilters },
        include: {
          shop: { select: { name: true } },
          customerRegion: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 80,
      })
    : [];

  const shopOrFilters: Prisma.ShopWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
    { ownerName: { contains: q, mode: "insensitive" } },
    { phone: { contains: q, mode: "insensitive" } },
    ...(qDigits ? [{ phone: { contains: qDigits, mode: "insensitive" } }] : []),
    { region: { name: { contains: q, mode: "insensitive" } } },
  ];

  const shops = includesScope(params.scope, "shops")
    ? await prisma.shop.findMany({
        where: { OR: shopOrFilters },
        include: { region: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 80,
      })
    : [];

  const courierOrFilters: Prisma.CourierWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
    { phone: { contains: q, mode: "insensitive" } },
    ...(qDigits ? [{ phone: { contains: qDigits, mode: "insensitive" } }] : []),
  ];

  const couriers = includesScope(params.scope, "couriers")
    ? await prisma.courier.findMany({
        where: { OR: courierOrFilters },
        orderBy: { updatedAt: "desc" },
        take: 80,
      })
    : [];

  const employeeOrFilters: Prisma.EmployeeWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
    { phone: { contains: q, mode: "insensitive" } },
    ...(qDigits ? [{ phone: { contains: qDigits, mode: "insensitive" } }] : []),
    { shop: { name: { contains: q, mode: "insensitive" } } },
  ];

  const employees = includesScope(params.scope, "employees")
    ? await prisma.employee.findMany({
        where: { OR: employeeOrFilters },
        include: { shop: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 80,
      })
    : [];

  const preparerOrFilters: Prisma.CompanyPreparerWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
    { phone: { contains: q, mode: "insensitive" } },
    ...(qDigits ? [{ phone: { contains: qDigits, mode: "insensitive" } }] : []),
    { notes: { contains: q, mode: "insensitive" } },
    { telegramUserId: { contains: q, mode: "insensitive" } },
  ];

  const companyPreparers = includesScope(params.scope, "preparers")
    ? await prisma.companyPreparer.findMany({
        where: { OR: preparerOrFilters },
        orderBy: { updatedAt: "desc" },
        take: 80,
      })
    : [];


  const wantsRegions = params.scope === "all" || params.scope === "settings";
  const regions = wantsRegions
    ? await prisma.region.findMany({
        where: {
          name: { contains: q, mode: "insensitive" },
        },
        orderBy: { updatedAt: "desc" },
        take: 80,
      })
    : [];

  const settings = includesScope(params.scope, "settings")
    ? ADMIN_TILES.filter((t) => {
        const hay = `${t.label} ${t.slug} ${t.emoji}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      }).map((t) => ({
        label: t.label,
        href: tileHref(t),
        reason: "مطابقة قسم من لوحة الإدارة",
      }))
    : [];

  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      shopName: normalizeAdminShopName(o.shop.name),
      customerPhone: o.customerPhone,
      summary: o.summary ?? "",
      orderType: o.orderType ?? "",
      totalAmount:
        o.totalAmount != null ? formatDinarAsAlfWithUnit(o.totalAmount) : "",
      createdAtIso: o.createdAt.toISOString(),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      alternatePhone: c.alternatePhone ?? "",
      shopName: normalizeAdminShopName(c.shop.name),
      regionName: c.customerRegion?.name ?? "",
      landmark: c.customerLandmark ?? "",
    })),
    shops: shops.map((s) => ({
      id: s.id,
      name: normalizeAdminShopName(s.name),
      ownerName: s.ownerName,
      phone: s.phone,
      regionName: s.region.name,
    })),
    couriers,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      phone: e.phone,
      shopName: normalizeAdminShopName(e.shop.name),
    })),
    companyPreparers: companyPreparers.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone ?? "",
      notes: p.notes ?? "",
    })),
    regions: regions.map((r) => ({
      id: r.id,
      name: r.name,
      deliveryPrice:
        r.deliveryPrice != null ? formatDinarAsAlfWithUnit(r.deliveryPrice) : "",
    })),
    settings,
  };
}
