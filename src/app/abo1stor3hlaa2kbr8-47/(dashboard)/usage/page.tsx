import { Metadata } from "next";
import { fetchVercelUsageReport, getVercelUsageConfig } from "@/lib/vercel-usage";
import { UsageClient } from "./usage-client";

export const metadata: Metadata = {
  title: "الاستخدام واستهلاك الموارد — لوحة الإدارة",
  description: "متابعة استهلاك موارد فيرسل ونقل البيانات ودوال السيرفر",
};

export default async function AdminUsagePage() {
  const [report, config] = await Promise.all([
    fetchVercelUsageReport(),
    getVercelUsageConfig(),
  ]);

  return <UsageClient initialReport={report} initialConfig={config} />;
}
