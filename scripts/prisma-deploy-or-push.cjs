/**
 * Vercel / CI: قاعدة بيانات قديمة بدون baseline لـ Prisma Migrate تُسبب P3005.
 * نحاول migrate deploy أولاً؛ إن فشل بـ P3005 نستخدم db push لمزامنة schema.prisma (إضافة جداول ناقصة).
 */
const { execSync } = require("node:child_process");

function shouldSkipDbDeployStep() {
  const skipFlag = process.env.SKIP_DB_DEPLOY === "1";
  const forceFlag = process.env.FORCE_DB_DEPLOY === "1";
  const hasDbUrl = !!process.env.DATABASE_URL;

  if (!hasDbUrl) return true;
  if (forceFlag) return false;
  return skipFlag;
}

/**
 * يضيف معامل statement_timeout للرابط لضمان عدم انقطاع الاتصال في Supabase/Postgres
 */
function augmentUrlWithTimeout(url) {
  if (!url) return url;
  if (url.includes("statement_timeout=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}statement_timeout=60000`; // 60 seconds
}

function runCapture(cmd, extraEnv = {}) {
  try {
    execSync(cmd, {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
    });
    return { ok: true, out: "" };
  } catch (e) {
    const stdout = e.stdout ? String(e.stdout) : "";
    const stderr = e.stderr ? String(e.stderr) : "";
    return { ok: false, out: `${stdout}\n${stderr}`, status: e.status ?? 1 };
  }
}

function runInherit(cmd, extraEnv = {}) {
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
}

function runLegacyDomainRewrite(extraEnv = {}) {
  const cmd =
    "npx prisma db execute --schema prisma/schema.prisma --file scripts/sql/replace-legacy-domain.sql";
  try {
    runInherit(cmd, extraEnv);
  } catch (e) {
    console.warn("[prisma] legacy domain rewrite skipped:", e?.message || e);
  }
}

function isTimeoutIssue(text) {
  return (
    /unknown config parameter.*transaction_timeout/i.test(text) ||
    /schema_connector::error.*transaction_timeout/i.test(text) ||
    /canceling statement due to statement timeout/i.test(text)
  );
}

function getBestEnv() {
  const direct = process.env.DIRECT_URL;
  const base = process.env.DATABASE_URL;
  // نفضل الـ Direct URL لعمليات الـ Schema
  let targetUrl = direct || base;
  if (!targetUrl) return {};

  return { DATABASE_URL: augmentUrlWithTimeout(targetUrl) };
}

if (shouldSkipDbDeployStep()) {
  console.log("[prisma] Skipping migrate/db-push in this environment.");
  process.exit(0);
}

const bestEnv = getBestEnv();

console.log("[prisma] Attempting migrate deploy...");
let migrate = runCapture("npx prisma migrate deploy", bestEnv);

// إذا فشل بسبب Timeout، نحاول مرة أخرى مع التأكد من الـ Env
if (!migrate.ok && isTimeoutIssue(migrate.out)) {
  console.warn("[prisma] Timeout detected during migrate deploy. Retrying with augmented URL...");
  migrate = runCapture("npx prisma migrate deploy", bestEnv);
}

if (migrate.ok) {
  runLegacyDomainRewrite(bestEnv);
  process.exit(0);
}

let combined = migrate.out || "";

const shouldFallbackToDbPush =
  combined.includes("P3005") ||
  /baseline an existing production database/i.test(combined) ||
  isTimeoutIssue(combined);

if (shouldFallbackToDbPush) {
  console.warn(
    "[prisma] Falling back to db push due to baseline or timeout...",
  );
  try {
    runInherit("npx prisma db push --skip-generate --accept-data-loss", bestEnv);
    runLegacyDomainRewrite(bestEnv);
    process.exit(0);
  } catch (e) {
    console.error("[prisma] db push failed:", e.message);
    process.exit(e.status ?? 1);
  }
}

console.error(combined.trim() || "prisma migrate deploy failed");
process.exit(migrate.status ?? 1);
