"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
  closeLabel?: string;
};

/**
 * زر يفتح صفحة المحفظة داخل نافذة كاملة الشاشة.
 * - لا يتم تحميل أي محتوى قبل فتح النافذة فعلياً.
 * - زر الرجوع في الجهاز يغلق النافذة أولاً إن كانت مفتوحة.
 */
export function FullscreenWalletLauncher({
  href,
  className,
  title,
  children,
  closeLabel = "إغلاق",
}: Props) {
  const [open, setOpen] = useState(false);
  const pushedRef = useRef(false);
  const resolvedTitle =
    title ??
    (href.includes("/mandoub/")
      ? "محفظة المندوب"
      : href.includes("/preparer/") || href.includes("/client/order/")
        ? "محفظة المجهز"
        : "المحفظة");

  const openModal = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.pushState({ walletFullscreenOpen: true }, "", window.location.href);
      pushedRef.current = true;
    }
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (typeof window !== "undefined" && pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
      return;
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      if (open) {
        pushedRef.current = false;
        setOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [open]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "WALLET_MODAL_CLOSE") {
        closeModal();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [closeModal]);

  return (
    <>
      <button type="button" onClick={openModal} className={className} title={title}>
        {children}
      </button>

      <div
        className={`fixed inset-0 z-[120] transition-opacity duration-200 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-black/25 dark:bg-black/50" />
        <div
          className={`relative flex h-full w-full flex-col bg-white transition-transform duration-200 ease-out dark:bg-slate-950 ${
            open ? "translate-y-0 scale-100" : "translate-y-2 scale-[0.995]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-black text-slate-900 dark:text-slate-100">{resolvedTitle}</p>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-red-500 bg-red-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-red-700"
            >
              {closeLabel}
            </button>
          </div>
          {open ? (
            <iframe
              src={href}
              title={resolvedTitle}
              loading="lazy"
              className="h-full w-full border-0"
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

