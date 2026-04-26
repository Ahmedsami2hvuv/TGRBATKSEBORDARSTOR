import { redirect } from "next/navigation";

/** المسار القديم: التوجيه إلى قسم الإدارة العام بعد إزالة قسم التقارير */
export default function WalletLedgerRedirectPage() {
  redirect("/admin");
}
