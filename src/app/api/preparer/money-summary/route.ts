import { NextResponse } from "next/server";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams.get("p") ?? "";
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("s") ?? "";

  const v = verifyCompanyPreparerPortalQuery(p, exp, sig);
  if (!v.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const totals = await getPreparerMoneyTotals(v.preparerId);
  if (!totals) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const wardDinar = Number(totals.ward);
  const saderDinar = Number(totals.sader);
  const remainDinar = Number(totals.remain);

  return NextResponse.json({
    wardStr: formatDinarAsAlfWithUnit(wardDinar),
    saderStr: formatDinarAsAlfWithUnit(saderDinar),
    remainStr: formatDinarAsAlfWithUnit(remainDinar),
    wardDinar,
    saderDinar,
    remainDinar,
  });
}
