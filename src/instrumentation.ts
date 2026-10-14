export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // تشغيل فحوصات قاعدة البيانات الآمنة في الخلفية دون حظر استجابة السيرفر للطلبات
  (async () => {
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

      // انتهت متطلبات فحص الجداول
    } catch (e) {
      console.warn("[instrumentation] background db-self-heal notice:", e);
    }
  })();
}

