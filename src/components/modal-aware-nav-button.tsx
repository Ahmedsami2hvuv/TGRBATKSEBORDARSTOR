"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
};

/**
 * إذا الصفحة داخل نافذة (iframe) يغلق النافذة.
 * وإلا ينتقل للرابط بشكل طبيعي.
 */
export function ModalAwareNavButton({ href, className, children }: Props) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "WALLET_MODAL_CLOSE" }, window.location.origin);
          return;
        }
        router.push(href);
      }}
      className={className}
    >
      {children}
    </button>
  );
}

