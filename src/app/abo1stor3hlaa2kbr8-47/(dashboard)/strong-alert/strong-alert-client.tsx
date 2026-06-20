"use client";

import React, { useState, useEffect } from "react";
import { ad } from "@/lib/admin-ui";

type UserItem = {
  id: string;
  name: string;
};

interface StrongAlertClientProps {
  couriers: UserItem[];
  preparers: UserItem[];
  employees: UserItem[];
}

export function StrongAlertClient({ couriers, preparers, employees }: StrongAlertClientProps) {
  const [activeTab, setActiveTab] = useState<"mandob" | "preparer" | "employee">("mandob");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [alertingState, setAlertingState] = useState<{
    isAlerting: boolean;
    activeRole: "mandob" | "preparer" | "employee" | null;
    activeUserIds: string[];
    timeLeft: number;
  }>({
    isAlerting: false,
    activeRole: null,
    activeUserIds: [],
    timeLeft: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    if (!alertingState.isAlerting) {
      setSelectedIds([]);
      setSearchQuery("");
      setError(null);
      setSuccessMessage(null);
    }
  }, [activeTab, alertingState.isAlerting]);

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
      // الحصول على التوكن من التخزين المحلي
      const prefsString = localStorage.getItem("AboAkbarPrefs") || sessionStorage.getItem("AboAkbarPrefs");
      let token = "";
      if (prefsString) {
        try {
          const parsed = JSON.parse(prefsString);
          token = parsed.admin_token || "";
        } catch {
          // محاولة استخراجه كنص عادي
          token = prefsString;
        }
      }

      if (!token) {
        // محاولة القراءة من الكوكيز
        const cookies = document.cookie.split(";");
        const adminCookie = cookies.find((c) => c.trim().startsWith("admin_token="));
        if (adminCookie) {
          token = adminCookie.split("=")[1] || "";
        }
      }

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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "فشل الاتصال بالخادم");
      }

      if (action === "start") {
        setAlertingState({
          isAlerting: true,
          activeRole: targetRole,
          activeUserIds: targetIds,
          timeLeft: 60,
        });
        setSuccessMessage(`تم إرسال التنبيه القوي بنجاح! سيستمر رنين الهواتف لمدة دقيقة أو حتى تضغط على زر الإيقاف.`);
      } else {
        setAlertingState({
          isAlerting: false,
          activeRole: null,
          activeUserIds: [],
          timeLeft: 0,
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

      {/* أزرار التحكم والتصنيف */}
      {!alertingState.isAlerting && (
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
      {!alertingState.isAlerting && (
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
                  <label
                    key={user.id}
                    className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-900/30 transition-colors ${
                      isSelected ? "bg-red-950/10" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectUser(user.id)}
                      className="rounded border-gray-700 text-red-600 focus:ring-red-500 focus:ring-offset-gray-900 w-4.5 h-4.5"
                    />
                    <div className="flex-1">
                      <span className={`font-semibold text-sm transition-colors ${isSelected ? "text-red-400" : "text-gray-200"}`}>
                        {user.name}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* زر التنبيه القوي */}
      {!alertingState.isAlerting && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => handleTriggerAlert("start")}
            disabled={loading || selectedIds.length === 0}
            className={`relative px-12 py-5 rounded-xl font-extrabold text-lg text-white shadow-2xl transition-all duration-300 transform ${
              selectedIds.length > 0
                ? "bg-red-600 hover:bg-red-500 cursor-pointer hover:scale-105 active:scale-95 shadow-red-600/30"
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
            {/* تأثير وميض خارجي نابض إذا تم تحديد أشخاص */}
            {selectedIds.length > 0 && (
              <span className="absolute inset-0 rounded-xl border border-red-500 animate-ping opacity-75"></span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
