import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { getPublicAppUrl } from "@/lib/app-url";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shopId } = await props.params;
    const baseUrl = getPublicAppUrl();

    const employees = await prisma.employee.findMany({
      where: { shopId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        shopId: true,
        name: true,
        phone: true,
        orderPortalToken: true,
      },
    });

    const result = employees.map((e) => ({
      id: e.id,
      shopId: e.shopId,
      name: e.name,
      phone: e.phone,
      portalUrl: buildEmployeeOrderPortalUrl(e.id, e.orderPortalToken, baseUrl),
    }));

    return NextResponse.json({ employees: result });
  } catch (error) {
    console.error("Error fetching shop employees:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
