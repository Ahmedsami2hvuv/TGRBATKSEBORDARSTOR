import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "استيراد دفعي من طلبات KSE القديمة — أبو الأكبر",
};

const ImportLegacyKseBatchClient = nextDynamic(
  () =>
    import("./import-legacy-kse-batch-client").then(
      (m) => m.ImportLegacyKseBatchClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-3xl p-4 text-sm text-slate-600">
        جاري تجهيز صفحة الاستيراد...
      </div>
    ),
  },
);

export default function ImportLegacyKsePage() {
  return <ImportLegacyKseBatchClient />;
}
