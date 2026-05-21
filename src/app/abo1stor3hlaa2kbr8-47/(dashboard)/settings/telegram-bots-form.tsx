"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { addTelegramBotAction, deleteTelegramBotAction, toggleTelegramBotActiveAction } from "./actions";

type TelegramBot = {
  id: string;
  name: string;
  username: string;
  token: string;
  purpose: string;
  active: boolean;
};

const PURPOSES = [
  { id: "admin", label: "بوت الإدارة" },
  { id: "notification", label: "بوت الإشعارات (كروب)" },
  { id: "courier", label: "بوت المناديب" },
  { id: "preparer", label: "بوت المجهزين" },
  { id: "customer", label: "بوت العملاء" },
  { id: "employee", label: "بوت الموظفين" },
  { id: "supplier", label: "بوت الموردين" },
];

export function TelegramBotsForm({
  initialBots,
  icons,
}: {
  initialBots: TelegramBot[];
  icons: GlobalIconsConfig;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [purpose, setPurpose] = useState("admin");

  const handleAdd = async () => {
    if (!name || !token) return;
    setLoading(true);
    try {
      await addTelegramBotAction({ name, username, token, purpose });
      setName("");
      setUsername("");
      setToken("");
      router.refresh();
    } catch (err) {
      alert("خطأ في إضافة البوت. تأكد من أن التوكن فريد.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <h3 className="text-xs font-black text-slate-800">إضافة بوت جديد</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 mr-1">نوع البوت</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-white"
            >
              {PURPOSES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 mr-1">اسم البوت</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: بوت الإدارة"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 mr-1">يوزر البوت</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@MyBot"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 mr-1">توكن البوت (API Token)</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456789:ABC..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
            />
          </div>
        </div>
        <button
          disabled={loading || !name || !token}
          onClick={handleAdd}
          className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm mt-2"
        >
          {loading ? "جاري الإضافة..." : "إضافة البوت"}
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-slate-500">البوتات المضافة</h3>
          <button
            onClick={async () => {
              if (loading) return;
              setLoading(true);
              try {
                const { syncTelegramWebhooksAction } = await import("./actions");
                const res = await syncTelegramWebhooksAction();
                if (res.error) alert(res.error);
                else alert("تمت إعادة تهيئة جميع الـ Webhooks بنجاح.");
              } finally {
                setLoading(false);
              }
            }}
            className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-1"
          >
            <DynamicIcon iconKey="ui_refresh" config={icons} className="w-3 h-3" />
            إعادة مزامنة الـ Webhooks
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {initialBots.length === 0 && (
            <p className="text-[10px] text-center text-slate-400 py-4 border border-dashed rounded-2xl">
              لا توجد بوتات مضافة حالياً.
            </p>
          )}
          {initialBots.map((bot) => (
            <div
              key={bot.id}
              className={`flex items-center justify-between gap-3 p-4 rounded-2xl border ${
                bot.active ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-60"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 text-[9px] font-black rounded text-slate-600">
                    {PURPOSES.find((p) => p.id === bot.purpose)?.label || bot.purpose}
                  </span>
                  <p className="text-sm font-black text-slate-800 truncate">{bot.name}</p>
                </div>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">{bot.username || "بدون يوزر"}</p>
                <p className="text-[8px] font-mono text-slate-400 truncate mt-1">
                  {bot.token.substring(0, 10)}...{bot.token.substring(bot.token.length - 5)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await toggleTelegramBotActiveAction(bot.id, !bot.active);
                    router.refresh();
                  }}
                  className={`p-2 rounded-xl border transition ${
                    bot.active
                      ? "bg-amber-50 border-amber-200 text-amber-600"
                      : "bg-emerald-50 border-emerald-200 text-emerald-600"
                  }`}
                >
                  <DynamicIcon
                    iconKey={bot.active ? "ui_eye_off" : "ui_eye"}
                    config={icons}
                    className="w-4 h-4"
                  />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("هل أنت متأكد من حذف هذا البوت؟ سيتم إلغاء ربطه نهائياً.")) return;
                    await deleteTelegramBotAction(bot.id);
                    router.refresh();
                  }}
                  className="p-2 rounded-xl border bg-rose-50 border-rose-200 text-rose-600 transition"
                >
                  <DynamicIcon iconKey="ui_trash" config={icons} className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
