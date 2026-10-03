import { ImportLegacyKseBatchClient } from "./import-legacy-kse-batch-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "استيراد دفعي من طلبات KSE القديمة — وصلي",
};

export default function ImportLegacyKsePage() {
  return <ImportLegacyKseBatchClient />;
}
