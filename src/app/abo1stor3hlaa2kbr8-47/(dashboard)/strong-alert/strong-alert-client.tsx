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
  // التبويب الرئيسي (تنبيه فوري / تنبيه مؤقت مجدول)
  const [mainTab, setMainTab] = useState<"instant" | "scheduled">("instant");

  // حالات التنبيه الفوري المعتادة
  const [activeTab, setActiveTab] = useState<"mandob" | "preparer" | "employee">("mandob");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [showOpenApp, setShowOpenApp] = useState(false);
  const [showDismiss, setShowDismiss] = useState(true);
  const [theme, setTheme] = useState("red");
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

  // حالات التنبيه المجدول/المؤقت
  const [scheduledAlerts, setScheduledAlerts] = useState<any[]>([]);
  const [schedRole, setSchedRole] = useState<"mandob" | "preparer" | "employee">("mandob");
  const [schedTargetType, setSchedTargetType] = useState<"all" | "custom">("all");
  const [schedSelectedUserIds, setSchedSelectedUserIds] = useState<string[]>([]);
  const [schedSearchQuery, setSchedSearchQuery] = useState("");
  const [schedTime, setSchedTime] = useState("08:00");
  const [schedType, setSchedType] = useState<"once" | "recurring">("recurring");
  const [schedDate, setSchedDate] = useState("");
  const [schedDays, setSchedDays] = useState<string[]>(["0", "1", "2", "3", "4", "5", "6"]); // 0-6 (0=Sunday)
  const [schedTitle, setSchedTitle] = useState("");
  const [schedBody, setSchedBody] = useState("");
  const [schedShowWhatsapp, setSchedShowWhatsapp] = useState(false);
  const [schedShowOpenApp, setSchedShowOpenApp] = useState(false);
  const [schedShowDismiss, setSchedShowDismiss] = useState(true);
  const [schedTheme, setSchedTheme] = useState("red");

  const alertingStateRef = React.useRef(alertingState);
  useEffect(() => {
    alertingStateRef.current = alertingState;
  }, [alertingState]);

  // جلب التنبيهات المجدولة عند تحميل الصفحة أو تبديل التبويب
  useEffect(() => {
    if (mainTab === "scheduled") {
      fetchScheduledAlerts();
    }
  }, [mainTab]);

  const fetchScheduledAlerts = async () => {
    try {
      const response = await fetch("/api/admin/strong-alert/scheduled", {
        headers: {
          "Authorization": `Bearer ${adminToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setScheduledAlerts(data.alerts || []);
      }
    } catch (e) {
      console.error("Error fetching scheduled alerts:", e);
      toast.error("فشل جلب التنبيهات المجدولة");
    }
  };

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

  const getSchedUsers = () => {
    switch (schedRole) {
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
  const filteredUsers = currentUsers.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const schedUsersList = getSchedUsers();
  const filteredSchedUsers = schedUsersList.filter((user) =>
    user.name.toLowerCase().includes(schedSearchQuery.toLowerCase())
  );

  // عند تغيير التبويب، قم بإعادة تعيين التحديد والبحث
  useEffect(() => {
    setSelectedIds([]);
    setSearchQuery("");
    setError(null);
    setSuccessMessage(null);
  }, [activeTab]);

  useEffect(() => {
    setSchedSelectedUserIds([]);
    setSchedSearchQuery("");
  }, [schedRole]);

  // الاستماع لاستجابات المستخدمين عبر Supabase Realtime
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
            const parts = newRow.note.split(":");
            if (parts.length >= 4) {
              const alertIdFromAck = parts[1];
              const role = parts[2];
              const userId = parts[3];
              
              const currentAlerting = alertingStateRef.current;
              
              if (!currentAlerting.isAlerting || currentAlerting.alertId !== alertIdFromAck) {
                console.log("تم تجاهل ACK قديم أو غير مطابق للتنبيه الحالي:", alertIdFromAck);
                return;
              }

              let userName = "";
              const allUsers = [...couriers, ...preparers, ...employees];
              const foundUser = allUsers.find(u => u.id === userId);
              if (foundUser) {
                userName = foundUser.name;
              } else {
                userName = role === "preparer" ? "المجهز" : role === "mandob" ? "المندوب" : "الموظف";
              }

              setRespondedName(userName);
              setRespondedRole(role);

              setAlertingState({
                isAlerting: false,
                activeRole: null,
                activeUserIds: [],
                timeLeft: 0,
                alertId: null,
              });

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

              try {
                const audio = new Audio('/success-sound.mp3');
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

  // فحص دوري للاستعلام عن استجابة المجهز (Polling)
  useEffect(() => {
    if (!alertingState.isAlerting || !alertingState.alertId) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/strong-alert?alertId=${alertingState.alertId}`);
        if (!response.ok) return;

        const data = await response.json();
        if (data.responded) {
          console.log("تم استلام الاستجابة عبر الفحص الدوري (Polling):", data);
          
          const role = data.role;
          const userId = data.userId;

          let userName = "";
          const allUsers = [...couriers, ...preparers, ...employees];
          const foundUser = allUsers.find(u => u.id === userId);
          if (foundUser) {
            userName = foundUser.name;
          } else {
            userName = role === "preparer" ? "المجهز" : role === "mandob" ? "المندوب" : "الموظف";
          }

          setRespondedName(userName);
          setRespondedRole(role);

          setAlertingState({
            isAlerting: false,
            activeRole: null,
            activeUserIds: [],
            timeLeft: 0,
            alertId: null,
          });

          const remainingUserIds = alertingState.activeUserIds.filter(id => id !== userId);
          if (remainingUserIds.length > 0) {
            fetch("/api/admin/strong-alert", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`,
              },
              body: JSON.stringify({
                action: "stop",
                targetRole: alertingState.activeRole,
                userIds: remainingUserIds,
                alertId: alertingState.alertId || "stop_alert"
              }),
            }).catch(err => console.error("Error auto stopping alert in polling:", err));
          }

          try {
            const audio = new Audio('/success-sound.mp3');
            audio.play().catch(() => {});
          } catch (e) {}
        }
      } catch (error) {
        console.error("خطأ أثناء الفحص الدوري لحالة التنبيه القوي:", error);
      }
    }, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    alertingState.isAlerting,
    alertingState.alertId,
    alertingState.activeUserIds,
    alertingState.activeRole,
    couriers,
    preparers,
    employees,
    adminToken
  ]);

  // إدارة المؤقت التنازلي
  useEffect(() => {
    if (!alertingState.isAlerting || alertingState.timeLeft <= 0) {
      if (alertingState.isAlerting && alertingState.timeLeft === 0) {
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
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
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

    if (action === "start" && !showDismiss && !showWhatsapp && !showOpenApp) {
      setError("يجب تفعيل خيار زر واحد على الأقل ليتمكن المستخدم من كتم التنبيه (زر الإغلاق، زر الواتساب، أو زر التطبيق)!");
      return;
    }

    if (!targetRole) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const alertId = "alert_" + Date.now().toString() + "_" + Math.random().toString(36).substring(7);

      const response = await fetch("/api/admin/strong-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          action,
          targetRole,
          userIds: targetIds,
          alertId,
          customTitle: action === "start" ? customTitle : undefined,
          customBody: action === "start" ? customBody : undefined,
          showWhatsapp: action === "start" ? showWhatsapp : undefined,
          showOpenApp: action === "start" ? showOpenApp : undefined,
          showDismiss: action === "start" ? showDismiss : undefined,
          theme: action === "start" ? theme : undefined,
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

  // التحكم في التنبيهات المجدولة (حفظ، تفعيل/تعطيل، حذف)
  const handleSaveScheduledAlert = async () => {
    let targetIdsStr = "all";
    if (schedTargetType === "custom") {
      if (schedSelectedUserIds.length === 0) {
        toast.error("يرجى تحديد مستخدم واحد على الأقل!");
        return;
      }
      targetIdsStr = schedSelectedUserIds.join(",");
    }

    if (!schedTime) {
      toast.error("يرجى تحديد وقت التنبيه!");
      return;
    }

    if (schedType === "once" && !schedDate) {
      toast.error("يرجى تحديد تاريخ التنبيه لمرة واحدة!");
      return;
    }

    if (schedType === "recurring" && schedDays.length === 0) {
      toast.error("يرجى تحديد يوم واحد على الأقل للتكرار!");
      return;
    }

    if (!schedShowDismiss && !schedShowWhatsapp && !schedShowOpenApp) {
      toast.error("يجب تفعيل خيار زر واحد على الأقل ليتمكن المستخدم من إيقاف التنبيه!");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/strong-alert/scheduled", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          targetRole: schedRole,
          targetIds: targetIdsStr,
          customTitle: schedTitle,
          customBody: schedBody,
          showWhatsapp: schedShowWhatsapp,
          showOpenApp: schedShowOpenApp,
          showDismiss: schedShowDismiss,
          theme: schedTheme,
          alertType: schedType,
          scheduledTime: schedTime,
          scheduledDate: schedType === "once" ? schedDate : null,
          daysOfWeek: schedType === "recurring" ? schedDays.join(",") : "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "فشل الاتصال بالسيرفر");
      }

      toast.success("تمت جدولة التنبيه بنجاح!");
      fetchScheduledAlerts();
      // إعادة تعيين النموذج
      setSchedTitle("");
      setSchedBody("");
      setSchedSelectedUserIds([]);
      setSchedTargetType("all");
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleScheduledAlert = async (recordId: string, currentActive: boolean) => {
    try {
      const response = await fetch("/api/admin/strong-alert/scheduled", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          recordId,
          isActive: !currentActive,
        }),
      });

      if (response.ok) {
        toast.success(currentActive ? "تم تعطيل التنبيه المجدول" : "تم تفعيل التنبيه المجدول");
        fetchScheduledAlerts();
      } else {
        toast.error("فشل تعديل حالة التنبيه");
      }
    } catch (e) {
      toast.error("حدث خطأ أثناء تعديل الحالة");
    }
  };

  const handleDeleteScheduledAlert = async (recordId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا التنبيه المجدول؟")) return;

    try {
      const response = await fetch(`/api/admin/strong-alert/scheduled?recordId=${recordId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${adminToken}`,
        },
      });

      if (response.ok) {
        toast.success("تم حذف التنبيه المجدول بنجاح");
        fetchScheduledAlerts();
      } else {
        toast.error("فشل حذف التنبيه");
      }
    } catch (e) {
      toast.error("حدث خطأ أثناء حذف التنبيه");
    }
  };

  const handleSelectSchedUser = (id: string) => {
    setSchedSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllSched = () => {
    const visibleIds = filteredSchedUsers.map((u) => u.id);
    const allSelected = visibleIds.every((id) => schedSelectedUserIds.includes(id));

    if (allSelected) {
      setSchedSelectedUserIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSchedSelectedUserIds((prev) => {
        const toAdd = visibleIds.filter((id) => !prev.includes(id));
        return [...prev, ...toAdd];
      });
    }
  };

  const daysLabels: { [key: string]: string } = {
    "0": "الأحد",
    "1": "الإثنين",
    "2": "الثلاثاء",
    "3": "الأربعاء",
    "4": "الخميس",
    "5": "الجمعة",
    "6": "السبت",
  };

  const formatDays = (daysStr: string) => {
    if (!daysStr) return "";
    return daysStr
      .split(",")
      .map((d) => daysLabels[d] || d)
      .join("، ");
  };

  const formatTime12Hr = (time24: string) => {
    if (!time24) return "";
    const [hrs, mins] = time24.split(":");
    const hr = parseInt(hrs, 10);
    const suffix = hr >= 12 ? "مساءً" : "صباحاً";
    const hr12 = hr % 12 === 0 ? 12 : hr % 12;
    return `${hr12}:${mins} ${suffix}`;
  };

  return (
    <div className="space-y-6">
      {/* التبويبات الرئيسية العلوية ذات الجمالية الراقية */}
      <div className="flex border-b border-gray-800 bg-gray-950/40 p-1.5 rounded-xl gap-2">
        <button
          onClick={() => setMainTab("instant")}
          className={`flex-1 py-3.5 text-center font-extrabold text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
            mainTab === "instant"
              ? "bg-red-950/60 text-red-400 border border-red-900/60 shadow-lg shadow-red-950/20"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <span>تنبيه فوري عاجل</span>
          <span>🚨</span>
        </button>
        <button
          onClick={() => setMainTab("scheduled")}
          className={`flex-1 py-3.5 text-center font-extrabold text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
            mainTab === "scheduled"
              ? "bg-blue-950/60 text-blue-400 border border-blue-900/60 shadow-lg shadow-blue-950/20"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <span>تنبيه مؤقت / مجدول</span>
          <span>📅</span>
        </button>
      </div>

      {mainTab === "instant" ? (
        // واجهة التنبيه الفوري الحالية
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
                <h3 className="text-lg font-bold text-red-500">جاري التنبيه الآن... 🚨</h3>
                <p className="text-sm text-red-400/80 mt-1 font-semibold">
                  جاري التنبيه وسوف يعمل صوت هاتف المجهز بأعلى صوت، وبمجرد نقره على زر فهمت ستتغير هذه الشاشة لتؤكد لك الاستلام فوراً.
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
                <h3 className="text-xl font-bold text-emerald-400">تم إيقاف التنبيه بنجاح! 🎉</h3>
                <p className="text-base text-gray-200 mt-2 font-semibold">
                  قام {respondedRole === "mandob" ? "المندوب" : respondedRole === "preparer" ? "المجهز" : "الموظف"} <span className="text-emerald-400 underline font-bold">{respondedName}</span> باستقبال التنبيه وايقافه وسوف يحدثك عبر الواتس اب
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

          {/* تخصيص نصوص وأزرار التنبيه القوي */}
          {!alertingState.isAlerting && !respondedName && (
            <div className="p-5 border border-gray-850 rounded-xl bg-gray-950/40 space-y-4">
              <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 border-b border-gray-850 pb-2">
                ⚙️ تخصيص نصوص وأزرار ومظهر التنبيه القوي (اختياري)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-semibold">عنوان التنبيه المخصص (إذا ترك فارغاً فلن يظهر أي نص):</label>
                  <input
                    type="text"
                    placeholder="مثال: أذكار الصباح، تنبيه إداري..."
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-gray-900 border border-gray-850 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-semibold">نص الرسالة المخصص (إذا ترك فارغاً فلن يظهر أي نص):</label>
                  <input
                    type="text"
                    placeholder="مثال: يرجى قراءة أذكار الصباح..."
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-gray-900 border border-gray-850 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-semibold">ستايل الشاشة (المظهر):</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-gray-900 border border-gray-850 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
                  >
                    <option value="red">🚨 تنبيه أحمر كلاسيكي (محسّن)</option>
                    <option value="islamic">🕌 أذكار / إسلامي (أخضر وذهبي)</option>
                    <option value="official">💼 رسمي / إداري (كحلي ملكي)</option>
                    <option value="sport">⚡ نشاط / رياضي (برتقالي دافئ)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showDismiss}
                    onChange={(e) => setShowDismiss(e.target.checked)}
                    className="rounded border-gray-700 text-red-600 focus:ring-red-500 focus:ring-offset-gray-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر إغلاق التنبيه المعتاد</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showWhatsapp}
                    onChange={(e) => setShowWhatsapp(e.target.checked)}
                    className="rounded border-gray-700 text-red-600 focus:ring-red-500 focus:ring-offset-gray-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر مراسلة الواتساب (اختياري)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showOpenApp}
                    onChange={(e) => setShowOpenApp(e.target.checked)}
                    className="rounded border-gray-700 text-red-600 focus:ring-red-500 focus:ring-offset-gray-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر فتح التطبيق (اختياري)</span>
                </label>
              </div>
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
      ) : (
        // واجهة التنبيه المؤقت المجدول
        <div className="space-y-8 animate-fadeIn">
          {/* قسم إعداد وضبط تنبيه مجدول جديد */}
          <div className="p-6 border border-gray-850 rounded-2xl bg-gray-950/40 space-y-6">
            <h3 className="text-base font-bold text-blue-400 flex items-center gap-2 border-b border-gray-850 pb-3">
              📅 ضبط وجدولة تنبيه مؤقت جديد (بتوقيت العراق المحلي)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* اختيار الفئة المستهدفة */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-bold block">1. الفئة المستهدفة:</label>
                <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
                  <button
                    type="button"
                    onClick={() => setSchedRole("mandob")}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-md transition-all ${
                      schedRole === "mandob" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    🛵 مندوب
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedRole("preparer")}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-md transition-all ${
                      schedRole === "preparer" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    📦 مجهز
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedRole("employee")}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-md transition-all ${
                      schedRole === "employee" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    💼 موظف
                  </button>
                </div>
              </div>

              {/* اختيار نوع الاستهداف (الكل أو مخصص) */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-bold block">2. تحديد الأسماء:</label>
                <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
                  <button
                    type="button"
                    onClick={() => setSchedTargetType("all")}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-md transition-all ${
                      schedTargetType === "all" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    📢 جميع الفئة
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedTargetType("custom")}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-md transition-all ${
                      schedTargetType === "custom" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    🎯 أشخاص محددين
                  </button>
                </div>
              </div>

              {/* تحديد وقت التنبيه */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-bold block">3. وقت التنبيه (توقيت العراق):</label>
                <div className="relative">
                  <input
                    type="time"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-850 rounded-lg text-sm text-gray-200 font-bold font-mono focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* قائمة اختيار الأسماء المحددة في حال الاستهداف المخصص */}
            {schedTargetType === "custom" && (
              <div className="space-y-2 border border-gray-850 p-4 rounded-xl bg-gray-950/20">
                <div className="flex items-center justify-between gap-4 pb-2 border-b border-gray-850">
                  <span className="text-xs text-gray-400 font-semibold">تحديد أسماء من الفئة:</span>
                  <div className="relative max-w-xs flex-1">
                    <input
                      type="text"
                      placeholder="البحث عن اسم..."
                      value={schedSearchQuery}
                      onChange={(e) => setSchedSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 bg-gray-900 border border-gray-850 rounded-md text-xs focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 text-xs text-gray-400">
                  <button
                    type="button"
                    onClick={handleSelectAllSched}
                    className="text-blue-500 hover:text-blue-400 font-bold"
                  >
                    {filteredSchedUsers.length > 0 && filteredSchedUsers.every((u) => schedSelectedUserIds.includes(u.id))
                      ? "إلغاء تحديد الكل"
                      : "تحديد الكل المفلتر"}
                  </button>
                  <span>المحدد: {schedSelectedUserIds.length} من {filteredSchedUsers.length}</span>
                </div>

                {filteredSchedUsers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-xs">
                    لا توجد أسماء مطابقة للبحث.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-850/40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-1">
                    {filteredSchedUsers.map((user) => {
                      const isSelected = schedSelectedUserIds.includes(user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => handleSelectSchedUser(user.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-900/40 transition-colors border ${
                            isSelected ? "bg-blue-950/10 border-blue-900/40" : "border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="pointer-events-none rounded border-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900 w-4 h-4"
                          />
                          <span className={`text-xs font-semibold ${isSelected ? "text-blue-400" : "text-gray-300"}`}>
                            {user.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* الجدولة الزمنية (تكرار / لمرة واحدة) */}
            <div className="p-4 border border-gray-850 rounded-xl bg-gray-900/30 space-y-4">
              <div className="flex items-center gap-6 border-b border-gray-850 pb-3">
                <span className="text-xs text-gray-400 font-bold">4. جدولة التنبيه:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="schedType"
                    checked={schedType === "recurring"}
                    onChange={() => setSchedType("recurring")}
                    className="text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900 w-4 h-4"
                  />
                  <span className="text-xs text-gray-200 font-bold">تكرار أسبوعي</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="schedType"
                    checked={schedType === "once"}
                    onChange={() => setSchedType("once")}
                    className="text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900 w-4 h-4"
                  />
                  <span className="text-xs text-gray-200 font-bold">مرة واحدة فقط</span>
                </label>
              </div>

              {schedType === "once" ? (
                <div className="space-y-1.5 max-w-xs">
                  <label className="text-xs text-gray-400 font-semibold">اختر تاريخ التنبيه:</label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-850 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-semibold block">اختر أيام التكرار الأسبوعية:</label>
                  <div className="flex flex-wrap gap-2">
                    {["0", "1", "2", "3", "4", "5", "6"].map((day) => {
                      const isSelected = schedDays.includes(day);
                      return (
                        <button
                          type="button"
                          key={day}
                          onClick={() => {
                            setSchedDays((prev) =>
                              prev.includes(day)
                                ? prev.filter((d) => d !== day)
                                : [...prev, day]
                            );
                          }}
                          className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                            isSelected
                              ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/30"
                              : "bg-gray-900 border-gray-850 text-gray-400 hover:border-gray-700"
                          }`}
                        >
                          {daysLabels[day]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* تخصيص نصوص ومظهر التنبيه المجدول */}
            <div className="p-4 border border-gray-850 rounded-xl bg-gray-900/30 space-y-4">
              <span className="text-xs text-gray-400 font-bold block">5. رسالة ومظهر التنبيه:</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-semibold">عنوان التنبيه المخصص (إذا ترك فارغاً فلن يظهر أي نص):</label>
                  <input
                    type="text"
                    placeholder="مثال: أذكار الصباح..."
                    value={schedTitle}
                    onChange={(e) => setSchedTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-850 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-semibold">نص التنبيه المخصص (إذا ترك فارغاً فلن يظهر أي نص):</label>
                  <input
                    type="text"
                    placeholder="مثال: حان الآن وقت الأذكار..."
                    value={schedBody}
                    onChange={(e) => setSchedBody(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-850 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-semibold">ستايل الشاشة (المظهر):</label>
                  <select
                    value={schedTheme}
                    onChange={(e) => setSchedTheme(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-850 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="red">🚨 تنبيه أحمر كلاسيكي (محسّن)</option>
                    <option value="islamic">🕌 أذكار / إسلامي (أخضر وذهبي)</option>
                    <option value="official">💼 رسمي / إداري (كحلي ملكي)</option>
                    <option value="sport">⚡ نشاط / رياضي (برتقالي دافئ)</option>
                  </select>
                </div>
              </div>

              {/* أزرار التحكم بالتنبيه */}
              <div className="flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedShowDismiss}
                    onChange={(e) => setSchedShowDismiss(e.target.checked)}
                    className="rounded border-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر إغلاق التنبيه المعتاد</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedShowWhatsapp}
                    onChange={(e) => setSchedShowWhatsapp(e.target.checked)}
                    className="rounded border-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر مراسلة الواتساب (إيقاف ومراسلة)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedShowOpenApp}
                    onChange={(e) => setSchedShowOpenApp(e.target.checked)}
                    className="rounded border-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر فتح التطبيق (اختياري)</span>
                </label>
              </div>
            </div>

            {/* زر الحفظ */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleSaveScheduledAlert}
                disabled={loading}
                className="px-10 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-extrabold text-sm rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                {loading ? "جاري الحفظ..." : "💾 حفظ وجدولة التنبيه"}
              </button>
            </div>
          </div>

          {/* قسم عرض التنبيهات المجدولة حالياً */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-200 flex items-center gap-2">
              📋 التنبيهات المجدولة الحالية ({scheduledAlerts.length})
            </h3>

            {scheduledAlerts.length === 0 ? (
              <div className="p-8 border border-gray-850 rounded-2xl bg-gray-950/20 text-center text-gray-500 text-sm">
                لا توجد أي تنبيهات مجدولة حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-850 rounded-2xl bg-gray-950/20">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="bg-gray-950/80 text-gray-400 border-b border-gray-850 font-bold">
                      <th className="px-4 py-3">الفئة المستهدفة</th>
                      <th className="px-4 py-3">الوقت (العراق)</th>
                      <th className="px-4 py-3">التكرار</th>
                      <th className="px-4 py-3">تفاصيل التنبيه</th>
                      <th className="px-4 py-3">الحالة</th>
                      <th className="px-4 py-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-850/40">
                    {scheduledAlerts.map((alert) => {
                      const roleLabel =
                        alert.targetRole === "mandob"
                          ? "🛵 مندوب"
                          : alert.targetRole === "preparer"
                          ? "📦 مجهز"
                          : "💼 موظف";
                      
                      const targetLabel =
                        alert.targetIds === "all"
                          ? "جميع الأسماء"
                          : `محدد (${alert.targetIds.split(",").length} شخص)`;

                      return (
                        <tr key={alert.recordId} className="hover:bg-gray-900/10 transition-colors">
                          {/* الفئة */}
                          <td className="px-4 py-4">
                            <div className="font-bold text-gray-200">{roleLabel}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{targetLabel}</div>
                          </td>
                          {/* الوقت */}
                          <td className="px-4 py-4 font-mono font-bold text-blue-400">
                            {formatTime12Hr(alert.scheduledTime)}
                          </td>
                          {/* التكرار */}
                          <td className="px-4 py-4 text-xs font-semibold">
                            {alert.alertType === "once" ? (
                              <span className="text-amber-500 bg-amber-950/20 px-2 py-1 rounded border border-amber-900/40">
                                لمرة واحدة: {alert.scheduledDate}
                              </span>
                            ) : (
                              <span className="text-emerald-500 bg-emerald-950/20 px-2 py-1 rounded border border-emerald-900/40">
                                مكرر أسبوعياً: {formatDays(alert.daysOfWeek)}
                              </span>
                            )}
                          </td>
                          {/* تفاصيل */}
                          <td className="px-4 py-4 text-xs">
                            <div className="font-bold text-gray-300">
                              العنوان: {alert.customTitle || <span className="text-gray-500 italic">فارغ (مموه)</span>}
                            </div>
                            <div className="text-gray-400 mt-1">
                              النص: {alert.customBody || <span className="text-gray-500 italic">فارغ (مموه)</span>}
                            </div>
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              <span className="bg-gray-900 px-1.5 py-0.5 rounded text-[10px] text-gray-400 border border-gray-800">
                                ستايل: {alert.theme === "red" ? "أحمر" : alert.theme === "islamic" ? "إسلامي" : alert.theme === "official" ? "رسمي" : "رياضي"}
                              </span>
                              {alert.showDismiss && (
                                <span className="bg-red-950/10 px-1.5 py-0.5 rounded text-[10px] text-red-400 border border-red-900/30">
                                  زر الإغلاق
                                </span>
                              )}
                              {alert.showWhatsapp && (
                                <span className="bg-emerald-950/10 px-1.5 py-0.5 rounded text-[10px] text-emerald-400 border border-emerald-900/30">
                                  إيقاف ومراسلة
                                </span>
                              )}
                              {alert.showOpenApp && (
                                <span className="bg-blue-950/10 px-1.5 py-0.5 rounded text-[10px] text-blue-400 border border-blue-900/30">
                                  زر التطبيق
                                </span>
                              )}
                            </div>
                          </td>
                          {/* الحالة */}
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => handleToggleScheduledAlert(alert.recordId, alert.isActive)}
                              className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                                alert.isActive
                                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/20"
                                  : "bg-red-950/40 text-red-400 border-red-800/60 hover:bg-red-900/20"
                              }`}
                            >
                              {alert.isActive ? "● نشط ومفعّل" : "○ معطّل مؤقتاً"}
                            </button>
                          </td>
                          {/* إجراءات */}
                          <td className="px-4 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteScheduledAlert(alert.recordId)}
                              className="p-2 bg-red-950/20 hover:bg-red-900/30 text-red-400 rounded-lg border border-red-900/50 hover:scale-105 active:scale-95 transition-all"
                              title="حذف الجدولة"
                            >
                              🗑️ حذف
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
