import { redirect } from "next/navigation";

export default function ReportsProfitsPage() {
  redirect("/admin/reports/preparation?type=profits");
}
