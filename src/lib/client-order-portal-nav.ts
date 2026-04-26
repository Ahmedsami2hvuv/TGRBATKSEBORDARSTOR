import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export function buildClientOrderPortalQuery(
  e: string,
  exp: string,
  sig: string,
): URLSearchParams {
  return new URLSearchParams({ e, exp, s: sig });
}

export function clientOrderFormPath(
  e: string,
  exp: string,
  sig: string,
  phoneRaw?: string,
): string {
  const q = buildClientOrderPortalQuery(e, exp, sig);
  const loc = normalizeIraqMobileLocal11(phoneRaw ?? "");
  if (loc) {
    q.set("phone", loc);
    q.set("customerPhone", loc);
  }
  return `/client/order?${q.toString()}`;
}

export function clientOrderEditPath(
  e: string,
  exp: string,
  sig: string,
  orderNumber: number,
  phoneRaw?: string,
): string {
  const q = buildClientOrderPortalQuery(e, exp, sig);
  q.set("edit", String(orderNumber));
  const loc = normalizeIraqMobileLocal11(phoneRaw ?? "");
  if (loc) {
    q.set("phone", loc);
    q.set("customerPhone", loc);
  }
  return `/client/order?${q.toString()}`;
}

export function clientOrderHistoryPath(
  e: string,
  exp: string,
  sig: string,
  phoneRaw?: string,
): string {
  const q = buildClientOrderPortalQuery(e, exp, sig);
  const loc = normalizeIraqMobileLocal11(phoneRaw ?? "");
  if (loc) {
    q.set("phone", loc);
    q.set("customerPhone", loc);
  }
  return `/client/order/history?${q.toString()}`;
}

export function clientOrderAccountPath(e: string, exp: string, sig: string): string {
  return `/client/order/account?${buildClientOrderPortalQuery(e, exp, sig).toString()}`;
}

export function clientOrderWalletPath(e: string, exp: string, sig: string): string {
  return `/client/order/wallet?${buildClientOrderPortalQuery(e, exp, sig).toString()}`;
}

export function clientOrderPreparationPath(e: string, exp: string, sig: string): string {
  return `/client/order/preparation?${buildClientOrderPortalQuery(e, exp, sig).toString()}`;
}
