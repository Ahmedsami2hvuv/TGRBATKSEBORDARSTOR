"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
  closeLabel?: string;
};

/**
 * تم تعديل المكون ليكون رابطاً عادياً بدلاً من نافذة منبثقة (Modal)
 * بناءً على طلب المستخدم لإلغاء النوافذ والتحميل بالخلفية.
 */
export function FullscreenWalletLauncher({
  href,
  className,
  title,
  children,
}: Props) {
  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  );
}
