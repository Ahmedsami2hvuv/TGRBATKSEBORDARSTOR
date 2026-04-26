"use client";

type ReportType = "general" | "meat" | "fish" | "profits";

const reportLabels: Record<ReportType, string> = {
  general: "التقرير العام",
  meat: "تقرير اللحوم",
  fish: "تقرير السمك",
  profits: "أرباحي",
};

const reportButtonBase =
  "block w-full rounded-3xl border p-4 text-sm font-bold transition disabled:opacity-70 text-center";
const reportButtonActive =
  "border-slate-900 bg-slate-900 text-white";
const reportButtonInactive =
  "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50";
const dateButtonBase =
  "block w-full rounded-3xl border px-4 py-3 text-sm font-semibold transition text-center";
const dateButtonActive =
  "border-slate-900 bg-slate-900 text-white";
const dateButtonInactive =
  "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50";

function parseYMDLocal(value: string): Date | null {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getDateRange(fromInput: string, toInput: string) {
  const start = parseYMDLocal(fromInput);
  const end = parseYMDLocal(toInput);
  if (!start || !end) return [];

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function ReportPreparationControls({
  selectedType,
  selectedDate,
  fromInput,
  toInput,
  todayIso,
  last30,
}: {
  selectedType: ReportType;
  selectedDate?: string;
  fromInput: string;
  toInput: string;
  todayIso: string;
  last30: string;
}) {
  const dates = getDateRange(fromInput, toInput);
  const resolvedSelectedDate = selectedDate ?? (fromInput === toInput ? fromInput : undefined);
  const activeDate = resolvedSelectedDate;
  const typeRangeFrom = resolvedSelectedDate ?? fromInput;
  const typeRangeTo = resolvedSelectedDate ?? toInput;

  const buildReportUrl = (type: ReportType, from: string, to: string) =>
    `/admin/reports/preparation?type=${encodeURIComponent(type)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black text-slate-900">اختر يوم</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {dates.map((date) => (
            <a
              key={date}
              href={buildReportUrl(selectedType, date, date)}
              className={`${dateButtonBase} ${
                date === activeDate ? dateButtonActive : dateButtonInactive
              }`}
            >
              {date}
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href={buildReportUrl(selectedType, todayIso, todayIso)}
          className="block rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-center font-bold text-slate-900 transition hover:border-sky-300 hover:bg-sky-100"
        >
          تقرير اليوم
        </a>
        <a
          href={buildReportUrl(selectedType, last30, todayIso)}
          className="block rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-center font-bold text-slate-900 transition hover:border-amber-300 hover:bg-amber-100"
        >
          تقارير آخر 30 يوم
        </a>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        {resolvedSelectedDate ? (
          <p>اختر نوع التقرير ليعرض بيانات اليوم المحدد أو استخدم نطاق التواريخ أدناه لعرض التقرير الكامل.</p>
        ) : (
          <p>اختر نوع التقرير للنطاق المحدد أعلاه (يمكنك تغيير التواريخ من النموذج).</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {( ["general", "meat", "fish", "profits"] as ReportType[]).map((type) => (
          <a
            key={type}
            href={buildReportUrl(type, typeRangeFrom, typeRangeTo)}
            className={`${reportButtonBase} ${
              type === selectedType ? reportButtonActive : reportButtonInactive
            }`}
          >
            {reportLabels[type]}
          </a>
        ))}
      </div>
    </>
  );
}
