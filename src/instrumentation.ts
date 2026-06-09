export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureEmployeeLocationColumnsIfMissing, ensurePreparerSalaryConfigColumnsIfMissing } = await import(
      "@/lib/db-self-heal-employee-location"
    );
    await ensureEmployeeLocationColumnsIfMissing();
    await ensurePreparerSalaryConfigColumnsIfMissing();
  } catch (e) {
    console.error("[instrumentation] db-self-heal-columns", e);
  }
}
