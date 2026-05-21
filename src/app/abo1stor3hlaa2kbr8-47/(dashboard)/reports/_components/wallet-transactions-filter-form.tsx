import { ad } from "@/lib/admin-ui";
import type { PartyFilter } from "@/lib/wallet-transactions-report";

type CourierOpt = { id: string; name: string };
type EmployeeOpt = { id: string; name: string; shopName: string };
type PreparerOpt = { id: string; name: string };

function defaultPartyForFilter(filter: PartyFilter): string {
  if (filter.mode === "all") return "";
  if (filter.mode === "courier") return `courier:${filter.courierId}`;
  if (filter.mode === "employee") return `employee:${filter.employeeId}`;
  return `preparer:${filter.preparerId}`;
}

export function WalletTransactionsFilterForm({
  fromInput,
  toInput,
  partyFilter,
  couriers,
  employees,
  preparers,
  searchQuery = "",
  showSearch = false,
}: {
  fromInput: string;
  toInput: string;
  partyFilter: PartyFilter;
  couriers: CourierOpt[];
  employees: EmployeeOpt[];
  preparers: PreparerOpt[];
  /** بحث نصّي في النتائج (مستودع المحافظ) */
  searchQuery?: string;
  showSearch?: boolean;
}) {
  const selected = defaultPartyForFilter(partyFilter);

  return (
    <form method="get" className={`flex flex-wrap items-end gap-3 ${ad.section}`}>
      <label className="flex flex-col gap-1">
        <span className={ad.label}>من تاريخ</span>
        <input type="date" name="from" defaultValue={fromInput} className={ad.input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={ad.label}>إلى تاريخ</span>
        <input type="date" name="to" defaultValue={toInput} className={ad.input} />
      </label>
      <label className="flex min-w-[min(100%,280px)] flex-col gap-1">
        <span className={ad.label}>صاحب المعاملة</span>
        <select name="party" defaultValue={selected} className={ad.input}>
          <option value="">الكل (الكلُّ — مندوبون، موظفون، مجهزون، تحويلات)</option>
          <optgroup label="مندوبون">
            {couriers.map((c) => (
              <option key={c.id} value={`courier:${c.id}`}>
                مندوب: {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="موظفو المحلات (بدون محفظة مجهز شركة)">
            {employees.map((e) => (
              <option key={e.id} value={`employee:${e.id}`}>
                موظف: {e.name} — {e.shopName}
              </option>
            ))}
          </optgroup>
          <optgroup label="مجهزو شركة">
            {preparers.map((p) => (
              <option key={p.id} value={`preparer:${p.id}`}>
                مجهز: {p.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {showSearch ? (
        <label className="flex min-w-[min(100%,280px)] flex-col gap-1">
          <span className={ad.label}>بحث في النتائج</span>
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="اسم، نوع، مبلغ، رقم طلب…"
            className={ad.input}
          />
        </label>
      ) : null}
      <button type="submit" className={ad.btnPrimary}>
        تطبيق
      </button>
    </form>
  );
}
