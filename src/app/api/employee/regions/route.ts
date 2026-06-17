import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";

function verifyRequest(request: Request) {
  const urlObj = new URL(request.url);
  const se = request.headers.get("x-employee-se") || urlObj.searchParams.get("se") || undefined;
  const exp = request.headers.get("x-employee-exp") || urlObj.searchParams.get("exp") || undefined;
  const sig = request.headers.get("x-employee-sig") || urlObj.searchParams.get("s") || undefined;
  
  if (!se || !exp || !sig) return { ok: false };
  return verifyStaffEmployeePortalQuery(se, exp, sig);
}

export async function GET(request: Request) {
  try {
    const verification = verifyRequest(request);
    if (!verification.ok) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const regions = await prisma.region.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ success: true, regions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
