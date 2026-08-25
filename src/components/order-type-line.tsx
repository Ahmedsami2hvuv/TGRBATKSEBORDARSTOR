import { isReversePickupOrderType, withoutReversePickupPrefix } from "@/lib/order-type-flags";

const REVERSE_LABEL = "طلب عكسي:";

const defaultPrefixClass =
  "font-black text-violet-950 bg-violet-100/95 px-1.5 py-0.5 rounded-md ring-1 ring-violet-400/70 shadow-sm";

/** تفاف أسطر طويلة لعرض النوع في الجوال (بدون البادئة) */
function formatOrderTypeMobileBody(body: string): string {
  const raw = body.trim();
  if (!raw) return "—";
  return raw
    .replace(/\s+/g, " ")
    .replace(/\bمستعجل\b/g, "سريع");
}

type OrderTypeLineProps = {
  orderType: string | null | undefined;
  empty?: string;
  className?: string;
  prefixClassName?: string;
  restClassName?: string;
};

/**
 * يعرض سطر نوع الطلب؛ إن وُجدت بادئة «طلب عكسي:» تُميَّز بخط غامق وخلفية واضحة.
 */
export function OrderTypeLine({
  orderType,
  empty = "—",
  className = "",
  prefixClassName = defaultPrefixClass,
  restClassName = "font-semibold text-slate-800",
}: OrderTypeLineProps) {
  const raw = String(orderType ?? "").trim();
  if (!raw) return <span className={className}>{empty}</span>;
  if (!isReversePickupOrderType(raw)) {
    return <span className={className}>{raw}</span>;
  }
  const rest = withoutReversePickupPrefix(raw);
  if (!rest) return null;
  return (
    <span className={className}>
      <span className={restClassName}>{rest}</span>
    </span>
  );
}

type OrderTypeDetailBlockProps = {
  orderType: string | null | undefined;
  className?: string;
  prefixClassName?: string;
  restClassName?: string;
};

/** مثل OrderTypeLine مع لف أسطر للجسم بعد البادئة (لصفحات تفاصيل المندوب/المجهز/الإدارة). */
export function OrderTypeDetailBlock({
  orderType,
  className = "",
  prefixClassName = defaultPrefixClass,
  restClassName = "font-semibold text-slate-900",
}: OrderTypeDetailBlockProps) {
  const raw = String(orderType ?? "").trim();
  if (!raw) return <span className={className}>—</span>;
  if (!isReversePickupOrderType(raw)) {
    return (
      <span className={`whitespace-pre-line ${className}`}>
        {formatOrderTypeMobileBody(raw)}
      </span>
    );
  }
  const rest = withoutReversePickupPrefix(raw);
  if (!rest) return <span className={className}>—</span>;
  const bodyLines = formatOrderTypeMobileBody(rest);
  return (
    <span className={`whitespace-pre-line ${className}`}>
      <span className={restClassName}>{bodyLines}</span>
    </span>
  );
}
