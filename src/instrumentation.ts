export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { 
      ensureEmployeeLocationColumnsIfMissing, 
      ensurePreparerSalaryConfigColumnsIfMissing,
      ensurePreparerWorkLogShiftNameColumnIfMissing 
    } = await import(
      "@/lib/db-self-heal-employee-location"
    );
    await ensureEmployeeLocationColumnsIfMissing();
    await ensurePreparerSalaryConfigColumnsIfMissing();
    await ensurePreparerWorkLogShiftNameColumnIfMissing();
  } catch (e) {
    console.error("[instrumentation] db-self-heal-columns", e);
  }
}
