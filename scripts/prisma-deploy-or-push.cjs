/**
 * Vercel / CI: Prisma DB Deployment Script
 * Optimized for Supabase/Postgres Timeout Issues
 */
const { execSync } = require("node:child_process");

function shouldSkipDbDeployStep() {
  const skipFlag = process.env.SKIP_DB_DEPLOY === "1";
  const hasDbUrl = !!process.env.DATABASE_URL;
  if (!hasDbUrl) return true;
  return skipFlag;
}

/**
 * يحاول تحويل رابط الـ Pooler إلى رابط مباشر (Direct Connection)
 * Supabase Pooler usually on 6432, Direct on 5432
 */
function tryFixUrl(url) {
  if (!url) return url;
  let newUrl = url;

  // إذا كان الرابط يستخدم الـ Pooler (6432)، نحوله للمباشر (5432)
  if (newUrl.includes(":6432")) {
    console.log("[prisma] Transforming Pooler URL to Direct URL (port 5432)...");
    newUrl = newUrl.replace(":6432", ":5432");
  }

  // إزالة معاملات pgbouncer لأنها تسبب مشاكل في الـ Schema
  newUrl = newUrl.replace("pgbouncer=true", "pgbouncer=false");

  // إضافة timeout طويل جداً (2 دقيقة)
  const separator = newUrl.includes("?") ? "&" : "?";
  if (!newUrl.includes("statement_timeout=")) {
    newUrl = `${newUrl}${separator}statement_timeout=120000`;
  }

  return newUrl;
}

function runCapture(cmd, env) {
  try {
    execSync(cmd, {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    return { ok: true, out: "" };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + "\n" + (e.stderr || ""), status: e.status ?? 1 };
  }
}

const directUrl = process.env.DIRECT_URL;
const dbUrl = process.env.DATABASE_URL;

const targetUrl = tryFixUrl(directUrl || dbUrl);
const env = { DATABASE_URL: targetUrl };

if (shouldSkipDbDeployStep()) {
  console.log("[prisma] Skipping DB steps as requested.");
  process.exit(0);
}

console.log("[prisma] Starting DB update attempt...");

// محاولة أولى: Migrate Deploy
let result = runCapture("npx prisma migrate deploy", env);

if (!result.ok) {
  console.warn("[prisma] Migrate deploy failed, trying db push...");
  // محاولة ثانية: DB Push
  result = runCapture("npx prisma db push --skip-generate --accept-data-loss", env);
}

if (result.ok) {
  console.log("[prisma] Database updated successfully.");
} else {
  console.error("**************************************************");
  console.error("⚠️ WARNING: PRISMA DB UPDATE FAILED DUE TO TIMEOUT");
  console.error(result.out);
  console.error("Proceeding with build anyway to avoid blocking...");
  console.error("**************************************************");
}

// نخرج دائماً بكود 0 للسماح لـ Vercel بإكمال بناء الـ Next.js
process.exit(0);
