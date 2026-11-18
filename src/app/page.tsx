import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();

  // 1. التحقق من كوكيز المندوب
  const mandoubC = cookieStore.get("mandoub_c")?.value;
  const mandoubS = cookieStore.get("mandoub_s")?.value;
  const mandoubExp = cookieStore.get("mandoub_exp")?.value;
  if (mandoubC && mandoubS) {
    try {
      const v = verifyDelegatePortalQuery(mandoubC, mandoubExp, mandoubS);
      if (v.ok) {
        redirect(
          `/mandoub?c=${encodeURIComponent(mandoubC)}&s=${encodeURIComponent(mandoubS)}${
            mandoubExp ? `&exp=${encodeURIComponent(mandoubExp)}` : ""
          }`
        );
      }
    } catch {}
  }

  // 2. التحقق من كوكيز عميل المحل
  const clientE = cookieStore.get("client_order_e")?.value;
  const clientExp = cookieStore.get("client_order_exp")?.value;
  const clientS = cookieStore.get("client_order_s")?.value;
  if (clientE && clientExp && clientS) {
    try {
      const v = verifyEmployeeOrderPortalQuery(clientE, clientExp, clientS);
      if (v.ok) {
        redirect(
          `/client/order?e=${encodeURIComponent(clientE)}&exp=${encodeURIComponent(
            clientExp
          )}&s=${encodeURIComponent(clientS)}`
        );
      }
    } catch {}
  }

  // 3. التحقق من كوكيز المجهز
  const prepP = cookieStore.get("preparer_p")?.value;
  const prepExp = cookieStore.get("preparer_exp")?.value;
  const prepS = cookieStore.get("preparer_s")?.value;
  if (prepP && prepExp) {
    try {
      const v = verifyCompanyPreparerPortalQuery(prepP, prepExp, prepS);
      if (v.ok) {
        redirect(
          `/preparer?p=${encodeURIComponent(prepP)}&exp=${encodeURIComponent(prepExp)}${
            prepS ? `&s=${encodeURIComponent(prepS)}` : ""
          }`
        );
      }
    } catch {}
  }

  redirect("/store");
}
