/** بناء استعلام موقّع لبوابة المجهز (p / exp / s) */
export function preparerPortalQueryString(p: string, exp: string, s: string): string {
  return new URLSearchParams({ p, exp, s }).toString();
}

export function preparerPath(path: string, auth: { p: string; exp: string; s: string }): string {
  const q = preparerPortalQueryString(auth.p, auth.exp, auth.s);
  const base = path.startsWith("/") ? path : `/${path}`;
  return `${base}?${q}`;
}
