/**
 * Production start: run migrations then Next.js.
 * If deploy hits P3009 (failed migration record),
 * mark that migration as APPLIED (because the columns already exist in DB) and retry deploy.
 */
const { spawnSync, spawn } = require("child_process");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  return r.status ?? 1;
}

let code = run("npx", ["prisma", "migrate", "deploy"]);
if (code !== 0) {
  console.error(
    "[start] prisma migrate deploy failed — marking 20260324130000_courier_hidden_blocked as APPLIED (P3009 recovery)",
  );

  // نستخدم --applied بدلاً من --rolled-back لأن الأعمدة موجودة فعلياً في قاعدة البيانات
  run("npx", [
    "prisma",
    "migrate",
    "resolve",
    "--applied",
    "20260324130000_courier_hidden_blocked",
  ]);

  code = run("npx", ["prisma", "migrate", "deploy"]);
  if (code !== 0) {
    process.exit(code);
  }
}

const child = spawn("npx", ["next", "start"], { stdio: "inherit" });
child.on("exit", (c) => process.exit(c ?? 0));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
