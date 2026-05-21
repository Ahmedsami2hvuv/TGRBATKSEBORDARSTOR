"use client";

export function AdminOrderFloatingBar({
  pending,
  hasCustomerImportChoice
}: {
  pending: boolean;
  hasCustomerImportChoice: boolean;
}) {
  if (hasCustomerImportChoice) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] w-full max-w-lg -translate-x-1/2 px-4 pointer-events-none">
      <button
        type="submit"
        form="admin-order-edit-form"
        disabled={pending}
        className="pointer-events-auto w-full rounded-2xl bg-sky-600 py-4 text-lg font-black text-white shadow-[0_8px_30px_rgb(0,0,0,0.2)] ring-4 ring-white transition-all hover:bg-sky-700 active:scale-95 disabled:opacity-60"
      >
        {pending ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات (تحديث)"}
      </button>
    </div>
  );
}
