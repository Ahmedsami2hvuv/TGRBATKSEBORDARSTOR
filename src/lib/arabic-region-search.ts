/** تطبيع نص عربي للمقارنة التقريبية (بحث مناطق من البوت). */

export function normalizeArabicSearch(s: string): string {
  let t = s.normalize("NFKC");
  t = t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  t = t.replace(/[أإآٱ]/g, "ا");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/ة/g, "ه");
  t = t.replace(/ؤ/g, "و");
  t = t.replace(/ئ/g, "ي");
  t = t.replace(/ـ/g, "");
  t = t.replace(/\s+/g, " ").trim().toLowerCase();
  return t;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + cost,
      );
      prev = tmp;
    }
  }
  return dp[n];
}

export type RegionSearchRow = { id: string; name: string };

/** يعيد أفضل المناطق تطابقاً مع الاستعلام (بدون اتصال بقاعدة البيانات). */
export function rankRegionsByQuery(
  query: string,
  regions: RegionSearchRow[],
  limit: number,
): { id: string; name: string; score: number }[] {
  const q = normalizeArabicSearch(query);
  if (!q) return [];

  const scored = regions.map((r) => {
    const name = normalizeArabicSearch(r.name);
    if (!name) return { id: r.id, name: r.name, score: -1 };
    let score: number;
    if (name.includes(q) || q.includes(name)) {
      score = 1000 - Math.abs(name.length - q.length);
    } else {
      const d = levenshtein(q, name);
      const maxLen = Math.max(q.length, name.length, 1);
      score = Math.round((1 - d / maxLen) * 500);
      const prefix = Math.min(q.length, name.length);
      let common = 0;
      for (let i = 0; i < prefix; i++) {
        if (q[i] === name[i]) common++;
      }
      score += common * 3;
    }
    return { id: r.id, name: r.name, score };
  });

  return scored
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
