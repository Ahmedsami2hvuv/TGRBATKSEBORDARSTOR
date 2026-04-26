import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const p = searchParams.get("p");
  const exp = searchParams.get("exp");
  const s = searchParams.get("s");

  if (!id || !p || !exp || !s) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const draft = await prisma.companyPreparerShoppingDraft.findUnique({
    where: { id },
    select: {
      id: true,
      data: true,
      placesCount: true,
      status: true
    }
  });

  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(draft);
}
