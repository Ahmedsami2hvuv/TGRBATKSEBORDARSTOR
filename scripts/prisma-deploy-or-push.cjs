/**
 * Vercel / CI: قاعدة بيانات قديمة بدون baseline لـ Prisma Migrate تُسبب P3005.
 * نحاول migrate deploy أولاً؛ إن فشل بـ P3005 نستخدم db push لمزامنة schema.prisma (إضافة جداول ناقصة).
 */
const { execSync } = require("node:child_process");

function shouldSkipDbDeployStep() {
  // Vercel build environment: running schema-changing commands here
  // can fail deploys and is better handled manually/out-of-band.
  const isVercel = process.env.VERCEL === "1";
  const skipFlag = process.env.SKIP_DB_DEPLOY === "1";
  const forceFlag = process.env.FORCE_DB_DEPLOY === "1";
  const hasDbUrl = !!process.env.DATABASE_URL;

  if (!hasDbUrl) return true;
  if (forceFlag) return false;
  return isVercel || skipFlag;
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

function hasPoolerTimeoutIssue(text) {
  return (
    /unknown config parameter.*transaction_timeout/i.test(text) ||
    /schema_connector::error.*transaction_timeout/i.test(text)
  );
}

function useDirectUrlEnv() {
  const direct = process.env.DIRECT_URL;
  if (!direct) return null;
  return { DATABASE_URL: direct };
}

if (shouldSkipDbDeployStep()) {
  console.log("[prisma] Skipping migrate/db-push in this environment.");
  process.exit(0);
}

let migrate = runCapture("npx prisma migrate deploy");
if (migrate.ok) {
  runLegacyDomainRewrite();
  process.exit(0);
}

let combined = migrate.out || "";
const directEnv = useDirectUrlEnv();

if (hasPoolerTimeoutIssue(combined) && directEnv) {
  console.warn("[prisma] pooler config issue detected. Retrying migrate deploy via DIRECT_URL…");
  migrate = runCapture("npx prisma migrate deploy", directEnv);
  if (migrate.ok) {
    runLegacyDomainRewrite(directEnv);
    process.exit(0);
  }
  combined = migrate.out || "";
}

const shouldFallbackToDbPush =
  combined.includes("P3005") ||
  /baseline an existing production database/i.test(combined) ||
  /statement timeout/i.test(combined) ||
  /canceling statement due to statement timeout/i.test(combined) ||
  hasPoolerTimeoutIssue(combined) ||
  /Error occurred during query execution/i.test(combined);

if (shouldFallbackToDbPush) {
  console.warn(
    "[prisma] migrate deploy failed (baseline/timeout). Falling back to db push…",
  );
  try {
    if (directEnv) {
      runInherit("npx prisma db push --skip-generate", directEnv);
      runLegacyDomainRewrite(directEnv);
    } else {
      runInherit("npx prisma db push --skip-generate");
      runLegacyDomainRewrite();
    }
    process.exit(0);
  } catch (e) {
    process.exit(e.status ?? 1);
  }
}

console.error(combined.trim() || "prisma migrate deploy failed");
process.exit(migrate.status ?? 1);
