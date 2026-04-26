import { verifyCustomerPushSignature } from "@/lib/customer-push-token";
import { CustomerPushSubscribe } from "./customer-push-subscribe";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تفعيل إشعارات الزبون — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ cid?: string; sig?: string }>;
};

export default async function ClientPushPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cid = sp.cid?.trim();
  const sig = sp.sig?.trim();
  if (!cid || !sig || !verifyCustomerPushSignature(cid, sig)) {
    return (
      <div
        dir="rtl"
        lang="ar"
        className="kse-app-bg flex min-h-screen flex-col items-center justify-center px-4 py-16 text-slate-800"
      >
        <div className="kse-app-inner max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-bold text-rose-700">رابط غير صالح</p>
          <p className="mt-2 text-sm text-slate-600">
            يجب فتح الرابط كاملاً كما أرسلته الإدارة. إن انتهت صلاحية الرابط اطلب رابطاً جديداً.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className="kse-app-bg flex min-h-screen flex-col items-center justify-center px-4 py-16"
    >
      <CustomerPushSubscribe customerId={cid} sig={sig} />
    </div>
  );
}
