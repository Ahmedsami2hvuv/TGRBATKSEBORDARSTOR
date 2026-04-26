"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStaffCategory, StaffStoreActionState } from "../../../../actions";
import { ad } from "@/lib/admin-ui";

const initialState: StaffStoreActionState = {};

export function CategoryForm({
  branchId,
  authParams
}: {
  branchId: string;
  authParams: { se: string; exp: string; s: string };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createStaffCategory, initialState);

  const authQ = new URLSearchParams(authParams).toString();

  useEffect(() => {
    if (state.ok) {
      router.push(`/staff/portal/store/branches/${branchId}?${authQ}`);
      router.refresh();
    }
  }, [state.ok, branchId, authQ, router]);

  return (
    <form action={action} className="space-y-4">
      {/* Auth hidden fields */}
      <input type="hidden" name="se" value={authParams.se} />
      <input type="hidden" name="exp" value={authParams.exp} />
      <input type="hidden" name="s" value={authParams.s} />
      <input type="hidden" name="branchId" value={branchId} />

      <label className="block">
        <span className={ad.label}>اسم القسم *</span>
        <input
          name="name"
          required
          placeholder="مثال: الخضروات، الفواكه..."
          className={ad.input}
        />
      </label>

      {state.error && (
        <p className="text-sm font-bold text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-purple-600 py-4 text-sm font-black text-white shadow-lg transition hover:bg-purple-700 disabled:opacity-50 active:scale-95"
      >
        {pending ? "جارٍ الحفظ..." : "حفظ القسم"}
      </button>
    </form>
  );
}
