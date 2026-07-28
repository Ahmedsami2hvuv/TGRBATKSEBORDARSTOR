import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    let token = authHeader?.split(" ")[1];

    if (!token) {
      const cookieHeader = request.headers.get("Cookie");
      if (cookieHeader) {
        const match = cookieHeader.split("; ").find(c => c.trim().startsWith("admin_token="));
        if (match) {
          token = match.split("=")[1];
        }
      }
    }

    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const couriers = await prisma.courier.findMany({
      where: {
        hiddenFromReports: false,
        blocked: false,
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ couriers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

