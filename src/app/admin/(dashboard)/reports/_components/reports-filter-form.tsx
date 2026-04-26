import { ad } from "@/lib/admin-ui";

export function ReportsFilterForm({
  fromInput,
  toInput,
  fromLabel = "من تاريخ",
  toLabel = "إلى تاريخ",
  children,
}: {
  fromInput: string;
  toInput: string;
  fromLabel?: string;
  toLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <form method="get" className={`flex flex-wrap items-end gap-3 ${ad.section}`}>
      <label className="flex flex-col gap-1">
        <span className={ad.label}>{fromLabel}</span>
        <input type="date" name="from" defaultValue={fromInput} className={ad.input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={ad.label}>{toLabel}</span>
        <input type="date" name="to" defaultValue={toInput} className={ad.input} />
      </label>
      {children}
      <button type="submit" className={ad.btnPrimary}>
        تطبيق
      </button>
    </form>
  );
}
