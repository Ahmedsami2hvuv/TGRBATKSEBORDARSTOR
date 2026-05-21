import { redirect } from "next/navigation";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export default function ReportsProfitsPage() {
  redirect(`${SECRET_ADMIN_PATH}/reports/preparation?type=profits`);
}

