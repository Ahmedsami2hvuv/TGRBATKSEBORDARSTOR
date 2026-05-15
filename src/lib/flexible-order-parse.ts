/**
 * مطابقة لـ logic_old.py: _extract_phone_from_text + _parse_flexible_order_lines
 * قائمة واتساب: عنوان، رقم، منتجات — بأي ترتيب للأسطر.
 */

import { normalizeDigits, parseAlfInputToDinarNumber } from "@/lib/money-alf";

export type FlexibleOrderParsed = {
  title: string;
  phone: string;
  products: string[];
};

export type QuickOrderParsed = {
  phone: string | null;
  price: number | null;
  regionQuery: string | null;
  orderType: string | null;
  remainingLines: string[];
};

export function extractPhoneFromText(line: string): string | null {
  if (!line?.trim()) return null;
  const digits = normalizeDigits(line);
  if (!digits) return null;
  if (digits.startsWith("964") && digits.length >= 12) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith("07") && digits.length >= 10) {
    return digits.slice(0, 11);
  }
  if (digits.length === 9 && digits.startsWith("7")) {
    return `0${digits}`;
  }
  return null;
}

export function parseQuickOrder(text: string): QuickOrderParsed {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let phone: string | null = null;
  let price: number | null = null;
  const otherLines: string[] = [];

  for (const line of lines) {
    const p = extractPhoneFromText(line);
    if (p && !phone) {
      phone = p;
      continue;
    }

    // Heuristic: if it looks like a pure price (e.g. "25" or "12.5")
    if (/^\d+(\.\d+)?$/.test(line) && price === null) {
      const pr = parseAlfInputToDinarNumber(line);
      if (pr !== null) {
        price = pr;
        continue;
      }
    }

    otherLines.push(line);
  }

  let regionQuery: string | null = null;
  let orderType: string | null = null;

  if (otherLines.length > 0) {
    regionQuery = otherLines[0]!;
    orderType = otherLines.slice(1).join(" ") || otherLines[0] || null;
  }

  return {
    phone,
    price,
    regionQuery,
    orderType,
    remainingLines: otherLines,
  };
}

export function parseFlexibleOrderLines(text: string): FlexibleOrderParsed | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) return null;

  let phoneIdx: number | null = null;
  let phoneNumber: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const candidate = extractPhoneFromText(lines[i]!);
    if (candidate) {
      phoneIdx = i;
      phoneNumber = candidate;
      break;
    }
  }

  if (phoneIdx == null || !phoneNumber) return null;

  const noDigitCandidates: number[] = [];
  const otherCandidates: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (i === phoneIdx) continue;
    if (/\d|[٠-٩۰-۹]/.test(lines[i]!)) {
      otherCandidates.push(i);
    } else {
      noDigitCandidates.push(i);
    }
  }

  let titleIdx: number | null = null;
  if (noDigitCandidates.length > 0) {
    titleIdx = noDigitCandidates[0]!;
  } else if (otherCandidates.length > 0) {
    titleIdx = otherCandidates[0]!;
  } else {
    return null;
  }

  const title = lines[titleIdx]!.trim();
  const products: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i === phoneIdx || i === titleIdx) continue;
    if (lines[i]!.trim()) {
      products.push(lines[i]!.trim());
    }
  }

  if (!title || !products.length) return null;

  return { title, phone: phoneNumber, products };
}
