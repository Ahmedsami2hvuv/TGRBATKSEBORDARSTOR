/**
 * بناء رابط العودة بعد مسح/حفظ لوكيشن المندوب — بدون `URL`/`URLSearchParams`
 * حتى لا تُعاد ترميز معاملات التوقيع أو تُفسَد.
 */
export function safeMandoubReturn(next: string): string {
  const t = next.trim();
  if (!t.startsWith("/mandoub")) {
    return "/mandoub";
  }
  return t;
}

export function appendMandoubLocFlash(
  next: string,
  flash: "cleared" | "saved",
): string {
  const base = safeMandoubReturn(next);
  const enc = encodeURIComponent(flash);
  const qIndex = base.indexOf("?");
  if (qIndex === -1) {
    return `${base}?loc=${enc}`;
  }
  const path = base.slice(0, qIndex);
  const query = base.slice(qIndex + 1);
  const segments = query.split("&").filter(Boolean);
  const kept: string[] = [];
  for (const seg of segments) {
    const eq = seg.indexOf("=");
    const name = eq === -1 ? seg : seg.slice(0, eq);
    if (name !== "loc") kept.push(seg);
  }
  kept.push(`loc=${enc}`);
  return `${path}?${kept.join("&")}`;
}
