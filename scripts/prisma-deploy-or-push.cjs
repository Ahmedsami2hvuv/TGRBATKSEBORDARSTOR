/**
 * Vercel / CI: قاعدة بيانات قديمة بدون baseline لـ Prisma Migrate تُسبب P3005.
 * نحاول migrate deploy أولاً؛ إن فشل بـ P3005 نستخدم db push لمزامنة schema.prisma (إضافة جداول ناقصة).
 */
const { execSync } = require("node:child_process");

function runCapture(cmd) {
  try {
    execSync(cmd, { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] });
    return { ok: true, out: "" };
  } catch (e) {
    const stdout = e.stdout ? String(e.stdout) : "";
    const stderr = e.stderr ? String(e.stderr) : "";
    return { ok: false, out: `${stdout}\n${stderr}`, status: e.status ?? 1 };
  }
}

function runInherit(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const migrate = runCapture("npx prisma migrate deploy");
if (migrate.ok) {
  process.exit(0);
}

const combined = migrate.out || "";
const shouldFallbackToDbPush =
  combined.includes("P3005") ||
  /baseline an existing production database/i.test(combined) ||
  /statement timeout/i.test(combined) ||
  /canceling statement due to statement timeout/i.test(combined) ||
  /Error occurred during query execution/i.test(combined);

if (shouldFallbackToDbPush) {
  console.warn(
    "[prisma] migrate deploy failed (baseline/timeout). Falling back to db push…",
  );
  try {
    runInherit("npx prisma db push --skip-generate");
    process.exit(0);
  } catch (e) {
    process.exit(e.status ?? 1);
  }
}

console.error(combined.trim() || "prisma migrate deploy failed");
process.exit(migrate.status ?? 1);
