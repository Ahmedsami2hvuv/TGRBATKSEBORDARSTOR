"use client";

import { useRouter } from "next/navigation";

export function MandoubWalletBackButton({ hrefMain }: { hrefMain: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "WALLET_MODAL_CLOSE" }, window.location.origin);
          return;
        }
        router.push(hrefMain);
      }}
      className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-600 px-5 text-center text-base font-black text-white shadow-sm transition hover:bg-sky-700"
    >
      رجوع
    </button>
  );
}

