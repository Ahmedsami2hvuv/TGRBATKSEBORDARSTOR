export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureEmployeeLocationColumnsIfMissing } = await import(
      "@/lib/db-self-heal-employee-location"
    );
    await ensureEmployeeLocationColumnsIfMissing();
  } catch (e) {
    console.error("[instrumentation] ensureEmployeeLocationColumnsIfMissing", e);
  }
}
