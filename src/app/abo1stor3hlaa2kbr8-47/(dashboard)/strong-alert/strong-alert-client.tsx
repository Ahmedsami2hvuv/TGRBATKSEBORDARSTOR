"use client";

import React, { useState, useEffect } from "react";
import { ad } from "@/lib/admin-ui";
import { supabaseClient } from "@/lib/supabase-client";
import { toast } from "sonner";

type UserItem = {
  id: string;
  name: string;
};

interface StrongAlertClientProps {
  couriers: UserItem[];
  preparers: UserItem[];
  employees: UserItem[];
  adminToken: string;
}

export function StrongAlertClient({ couriers, preparers, employees, adminToken }: StrongAlertClientProps) {
  const [activeTab, setActiveTab] = useState<"mandob" | "preparer" | "employee">("mandob");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [alertingState, setAlertingState] = useState<{
    isAlerting: boolean;
    activeRole: "mandob" | "preparer" | "employee" | null;
    activeUserIds: string[];
    timeLeft: number;
    alertId: string | null;
  }>({
    isAlerting: false,
    activeRole: null,
    activeUserIds: [],
    timeLeft: 0,
    alertId: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [respondedName, setRespondedName] = useState<string | null>(null);
  const [respondedRole, setRespondedRole] = useState<string | null>(null);

  // مرجع للاحتفاظ بأحدث حالة للتنبيه لاستخدامها داخل الـ useEffect دون التسبب في إعادة الاشتراك
  const alertingStateRef = React.useRef(alertingState);
  useEffect(() => {
    alertingStateRef.current = alertingState;
  }, [alertingState]);

  // احصل على قائمة المستخدمين بناء على التبويب النشط
  const getCurrentUsers = () => {
    switch (activeTab) {
      case "mandob":
        return couriers;
      case "preparer":
        return preparers;
      case "employee":
        return employees;
      default:
        return [];
    }
  };

  const currentUsers = getCurrentUsers();

  // تصفية المستخدمين بناء على البحث
  const filteredUsers = currentUsers.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // عند تغيير التبويب، قم بإعادة تعيين التحديد والبحث
  useEffect(() => {
    setSelectedIds([]);
    setSearchQuery("");
    setError(null);
    setSuccessMessage(null);
  }, [activeTab]);

  // الاستماع لاستجابات المستخدمين عبر Supabase Realtime (قاعدة البيانات بدلاً من Broadcast)
  useEffect(() => {
    const channel = supabaseClient
      .channel("schema-placeholder-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "SchemaPlaceholder",
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow && newRow.note && newRow.note.startsWith("strong_alert_ack:")) {
            console.log("استجابة جديدة (DB):", newRow.note);
            // note format: strong_alert_ack:alertId:role:userId:timestamp
            const parts = newRow.note.split(":");
            if (parts.length >= 4) {
              const alertIdFromAck = parts[1];
              const role = parts[2];
              const userId = parts[3];
              
              const currentAlerting = alertingStateRef.current;
              
              // التحقق من أن هذا الـ ACK يخص التنبيه النشط حالياً لمنع التداخل مع تنبيهات قديمة
              if (!currentAlerting.isAlerting || currentAlerting.alertId !== alertIdFromAck) {
                console.log("تم تجاهل ACK قديم أو غير مطابق للتنبيه الحالي:", alertIdFromAck);
                return;
              }

              // البحث عن اسم المستخدم
              let userName = "مستخدم";
              const allUsers = [...couriers, ...preparers, ...employees];
              const foundUser = allUsers.find(u => u.id === userId);
              if (foundUser) userName = foundUser.name;

              // تحديث حالة الاستجابة لتظهر في واجهة المستخدم بوضوح
              setRespondedName(userName);
              setRespondedRole(role);

              // إيقاف الشاشة الحمراء الوامضة محلياً
              setAlertingState({
                isAlerting: false,
                activeRole: null,
                activeUserIds: [],
                timeLeft: 0,
                alertId: null,
              });

              // إرسال إشارة إيقاف (action = stop) تلقائياً لبقية الهواتف التي تم تنبيهها
              // نرسلها فقط لبقية المستخدمين الذين لم يستجيبوا، ونستبعد الشخص المستجيب
              const remainingUserIds = currentAlerting.activeUserIds.filter(id => id !== userId);
              if (remainingUserIds.length > 0) {
                fetch("/api/admin/strong-alert", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`,
                  },
                  body: JSON.stringify({
                    action: "stop",
                    targetRole: currentAlerting.activeRole,
                    userIds: remainingUserIds,
                    alertId: alertIdFromAck || "stop_alert"
                  }),
                }).catch(err => console.error("Error auto stopping alert:", err));
              }

              // تشغيل صوت تنبيه خفيف في الإدارة (اختياري، لكنه مفيد)
              try {
                const audio = new Audio('/success-sound.mp3'); // إذا كان موجوداً
                audio.play().catch(() => {});
              } catch (e) {}
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [couriers, preparers, employees, adminToken]);

  // إدارة المؤقت التنازلي لإيقاف التنبيه تلقائياً بعد دقيقة
  useEffect(() => {
    if (!alertingState.isAlerting || alertingState.timeLeft <= 0) {
      if (alertingState.isAlerting && alertingState.timeLeft === 0) {
        // انتهى الوقت، قم بإنهاء التنبيه محلياً
        setAlertingState({
          isAlerting: false,
          activeRole: null,
          activeUserIds: [],
          timeLeft: 0,
          alertId: null,
        });
        setSuccessMessage("انتهى وقت التنبيه التلقائي (60 ثانية).");
      }
      return;
    }

    const timer = setTimeout(() => {
      setAlertingState((prev) => ({
        ...prev,
        timeLeft: prev.timeLeft - 1,
      }));
    }, 1000);

    return () => clearTimeout(timer);
  }, [alertingState.isAlerting, alertingState.timeLeft]);

  const handleSelectUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const visibleIds = filteredUsers.map((u) => u.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      // إزالة كل المستخدمين المفلترين من التحديد
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      // إضافة كل المستخدمين المفلترين غير المحددين
      setSelectedIds((prev) => {
        const toAdd = visibleIds.filter((id) => !prev.includes(id));
        return [...prev, ...toAdd];
      });
    }
  };

  const handleTriggerAlert = async (action: "start" | "stop") => {
    const targetIds = action === "start" ? selectedIds : alertingState.activeUserIds;
    const targetRole = action === "start" ? activeTab : alertingState.activeRole;

    if (action === "start" && targetIds.length === 0) {
      setError("يرجى تحديد شخص واحد على الأقل لإرسال التنبيه.");
      return;
    }

    if (!targetRole) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = adminToken;

      const alertId = "alert_" + Date.now().toString() + "_" + Math.random().toString(36).substring(7);

      const response = await fetch("/api/admin/strong-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          targetRole,
          userIds: targetIds,
          alertId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "فشل الاتصال بالخادم");
      }

      if (action === "start") {
        setRespondedName(null);
        setRespondedRole(null);
        setAlertingState({
          isAlerting: true,
          activeRole: targetRole,
          activeUserIds: targetIds,
          timeLeft: 60,
          alertId: alertId,
        });
        setSuccessMessage(`تم إرسال التنبيه القوي بنجاح! سيستمر رنين الهواتف لمدة دقيقة أو حتى تضغط على زر الإيقاف.`);
      } else {
        setRespondedName(null);
        setRespondedRole(null);
        setAlertingState({
          isAlerting: false,
          activeRole: null,
          activeUserIds: [],
          timeLeft: 0,
          alertId: null,
        });
        setSuccessMessage("تم إرسال إشارة إيقاف التنبيه لجميع الهواتف المحددة.");
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800 text-red-400 rounded-lg text-sm font-semibold">
          ⚠️ {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800 text-emerald-400 rounded-lg text-sm font-semibold">
          ✅ {successMessage}
        </div>
      )}

      {/* شاشة حالة التنبيه النشطة */}
      {alertingState.isAlerting && (
        <div className="p-6 bg-red-950/30 border border-red-500/40 rounded-xl flex flex-col items-center justify-center text-center space-y-4 shadow-lg shadow-red-950/50 animate-pulse">
          <div className="relative">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white font-bold text-xl shadow-lg shadow-red-600/50">
              🚨
            </span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-500">تنبيه قوي نشط حالياً!</h3>
            <p className="text-sm text-red-400/80 mt-1">
              يتم الآن إطلاق صوت إنذار مستمر واهتزاز قوي على هواتف المستخدمين المحددين.
            </p>
            <p className="text-xs text-amber-500 mt-2 font-mono">
              الوقت المتبقي للإيقاف التلقائي: {alertingState.timeLeft} ثانية
            </p>
          </div>

          <button
            onClick={() => handleTriggerAlert("stop")}
            disabled={loading}
            className="px-8 py-3 bg-white hover:bg-gray-100 text-red-700 font-bold rounded-lg shadow-lg border border-red-300 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            {loading ? "جاري الإيقاف..." : "⏹️ إيقاف التنبيه الآن"}
          </button>
        </div>
      )}

      {/* شاشة استجابة المستخدم الناجحة */}
      {respondedName && (
        <div className="p-8 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex flex-col items-center justify-center text-center space-y-4 shadow-lg shadow-emerald-950/50">
          <div className="relative">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-2xl shadow-lg shadow-emerald-600/50 animate-bounce">
              ✓
            </span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-emerald-400">تمت الاستجابة للتنبيه!</h3>
            <p className="text-base text-gray-200 mt-2 font-semibold">
              لقد استجاب {respondedRole === "mandob" ? "المندوب" : respondedRole === "preparer" ? "المجهز" : "الموظف"} <span className="text-emerald-400 underline font-bold">{respondedName}</span> للاشعار وسوف يقوم بمراسلتك عبر الواتساب
            </p>
          </div>

          <button
            onClick={() => {
              setRespondedName(null);
              setRespondedRole(null);
              setSuccessMessage(null);
            }}
            className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg border border-emerald-500 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            العودة للوحة التحكم
          </button>
        </div>
      )}

      {/* أزرار التحكم والتصنيف */}
      {!alertingState.isAlerting && !respondedName && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* تبويبات الفئات */}
          <div className="md:col-span-2 flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab("mandob")}
              className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all ${
                activeTab === "mandob"
                  ? "border-red-500 text-red-500"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              🛵 المندوبين ({couriers.length})
            </button>
            <button
              onClick={() => setActiveTab("preparer")}
              className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all ${
                activeTab === "preparer"
                  ? "border-red-500 text-red-500"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              📦 المجهزين ({preparers.length})
            </button>
            <button
              onClick={() => setActiveTab("employee")}
              className={`flex-1 py-3 text-center font-bold text-sm border-b-2 transition-all ${
                activeTab === "employee"
                  ? "border-red-500 text-red-500"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              💼 الموظفين ({employees.length})
            </button>
          </div>

          {/* شريط البحث */}
          <div className="relative">
            <input
              type="text"
              placeholder="البحث عن اسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-red-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* قائمة الأسماء */}
      {!alertingState.isAlerting && !respondedName && (
        <div className="border border-gray-850 rounded-xl bg-gray-950/20 overflow-hidden">
          {/* رأس القائمة */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-950/60 border-b border-gray-850">
            <button
              onClick={handleSelectAll}
              className="text-xs text-red-500 hover:text-red-400 font-bold transition-colors"
            >
              {filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.includes(u.id))
                ? "إلغاء تحديد الكل"
                : "تحديد كل الأسماء المفلترة"}
            </button>
            <span className="text-xs text-gray-400">
              المحدد حالياً: {selectedIds.length} من أصل {filteredUsers.length}
            </span>
          </div>

          {/* محتوى الأسماء */}
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              لا توجد أسماء مطابقة لعملية البحث.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-850/60">
              {filteredUsers.map((user) => {
                const isSelected = selectedIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-900/30 transition-colors ${
                      isSelected ? "bg-red-950/10" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="pointer-events-none rounded border-gray-700 text-red-600 focus:ring-red-500 focus:ring-offset-gray-900 w-4.5 h-4.5"
                    />
                    <div className="flex-1">
                      <span className={`font-semibold text-sm transition-colors ${isSelected ? "text-red-400" : "text-gray-200"}`}>
                        {user.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* زر التنبيه القوي */}
      {!alertingState.isAlerting && !respondedName && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => handleTriggerAlert("start")}
            disabled={loading || selectedIds.length === 0}
            className={`relative px-12 py-5 rounded-xl font-extrabold text-lg text-white shadow-2xl transition-all duration-300 transform ${
              selectedIds.length > 0
                ? "bg-red-600 hover:bg-red-500 cursor-pointer hover:scale-105 active:scale-95 shadow-[0_0_25px_rgba(239,68,68,0.6)] animate-pulse"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
          >
            {loading ? (
              "جاري إرسال الإشعار..."
            ) : (
              <span className="flex items-center gap-2">
                <span>إطلاق التنبيه القوي</span>
                <span>🚨</span>
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
