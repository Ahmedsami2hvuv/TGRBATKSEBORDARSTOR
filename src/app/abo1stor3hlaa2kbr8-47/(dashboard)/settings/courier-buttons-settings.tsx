"use client";

import { useState, useEffect } from "react";
import { updateCourierButtonsAction } from "./actions";

type Courier = {
  id: string;
  name: string;
  showDoorBtn: boolean;
  showLocationBtn: boolean;
  showCallBtn: boolean;
  showWhatsAppBtn: boolean;
  showNotesBtn: boolean;
  showVoiceNotesBtn: boolean;
};

export function CourierButtonsSettings() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

  useEffect(() => {
    setLoading(true);
    fetch(`/api${SECRET_ADMIN_PATH}/couriers`)
      .then((res) => res.json())
      .then((data) => {
        setCouriers(data);
        if (data.length > 0) setSelectedCourierId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedCourier = couriers.find((c) => c.id === selectedCourierId);

  const toggleBtn = async (key: keyof Omit<Courier, "id" | "name">, value: boolean) => {
    if (!selectedCourierId) return;
    setSaving(true);
    const res = await updateCourierButtonsAction(selectedCourierId, { [key]: value });
    if (res.ok) {
      setCouriers((prev) =>
        prev.map((c) => (c.id === selectedCourierId ? { ...c, [key]: value } : c))
      );
    } else {
      alert("فشل التحديث: " + res.error);
    }
    setSaving(false);
  };

  if (loading) return <div className="text-center py-4 font-bold text-slate-500">جاري تحميل المندوبين...</div>;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-black text-slate-700">اختر المندوب لتخصيص أزراره:</label>
        <select
          value={selectedCourierId}
          onChange={(e) => setSelectedCourierId(e.target.value)}
          className="w-full rounded-xl border border-slate-300 p-3 font-bold outline-none focus:border-indigo-500"
        >
          {couriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {selectedCourier && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ButtonToggle
            label="موقع الزبون (Location)"
            checked={selectedCourier.showLocationBtn}
            onChange={(v) => toggleBtn("showLocationBtn", v)}
            disabled={saving}
          />
          <ButtonToggle
            label="صورة الباب"
            checked={selectedCourier.showDoorBtn}
            onChange={(v) => toggleBtn("showDoorBtn", v)}
            disabled={saving}
          />
          <ButtonToggle
            label="ملاحظات صوتية"
            checked={selectedCourier.showVoiceNotesBtn}
            onChange={(v) => toggleBtn("showVoiceNotesBtn", v)}
            disabled={saving}
          />
          <ButtonToggle
            label="ملاحظات كتابية"
            checked={selectedCourier.showNotesBtn}
            onChange={(v) => toggleBtn("showNotesBtn", v)}
            disabled={saving}
          />
          <ButtonToggle
            label="اتصال هاتف"
            checked={selectedCourier.showCallBtn}
            onChange={(v) => toggleBtn("showCallBtn", v)}
            disabled={saving}
          />
          <ButtonToggle
            label="مراسلة واتساب"
            checked={selectedCourier.showWhatsAppBtn}
            onChange={(v) => toggleBtn("showWhatsAppBtn", v)}
            disabled={saving}
          />
        </div>
      )}
      {saving && <p className="text-[10px] font-bold text-indigo-600 animate-pulse">جاري حفظ التغييرات...</p>}
    </div>
  );
}

function ButtonToggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
    </label>
  );
}
