import { getPartners } from "./actions";
import { CreditBookClient } from "./credit-book-client";

export const dynamic = "force-dynamic";

export default async function CreditBookPage() {
  const initialPartners = await getPartners();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 text-right">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center justify-end gap-3">
          📘 دفتر الديون العام
        </h1>
        <p className="mt-2 text-slate-500 font-bold">
          إدارة حسابات ومستحقات المناديب، المجهزين، المحلات، والزبائن في مكان واحد.
        </p>
      </div>

      <CreditBookClient initialPartners={initialPartners} />
    </div>
  );
}
