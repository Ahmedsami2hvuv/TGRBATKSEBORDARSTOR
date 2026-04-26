"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";

export function VisualDesignerProvider({
  children, target, section, isAdmin
}: {
  children: ReactNode, target: string, section: string, isAdmin: boolean
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <div className="relative min-h-full">
      {/*
          الزر يظهر فقط إذا كان isAdmin صحيحاً.
           isAdmin يتم تمريرها من السيرفر بعد التأكد من Admin Cookie.
      */}
      {isAdmin && (
        <div className="fixed bottom-24 left-6 z-[9999]">
          <Link
            href={`/admin/settings/ui-designer?target=${target}&section=${section}`}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-600 text-white shadow-[0_10px_40px_rgba(14,165,233,0.5)] border-4 border-white hover:scale-110 active:scale-95 transition-all animate-bounce"
            title="إعدادات الستايل (للمسؤول فقط)"
          >
            <span className="text-3xl">🎨</span>
          </Link>
        </div>
      )}
      {children}
    </div>
  );
}

export function DesignableBlock({ children }: { id: string, children: ReactNode, label: string }) {
  return <>{children}</>;
}
