"use client";

import React, { useState, useEffect } from "react";
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
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null); // معرف التنبيه الجاري تعديله

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

  // التحكم في التنبيهات المجدولة (حفظ أو تعديل)
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
      const url = "/api/admin/strong-alert/scheduled";
      const method = editingRecordId ? "PUT" : "POST";
      const payload: any = {
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
      };

      if (editingRecordId) {
        payload.recordId = editingRecordId;
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "فشل الاتصال بالسيرفر");
      }

      toast.success(editingRecordId ? "تم تحديث وحفظ التعديلات بنجاح!" : "تمت جدولة التنبيه بنجاح!");
      fetchScheduledAlerts();
      
      // إعادة تعيين النموذج وإنهاء التعديل
      resetForm();
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  // تعبئة البيانات في النموذج لبدء التعديل
  const handleStartEdit = (alert: any) => {
    setEditingRecordId(alert.recordId);
    setSchedRole(alert.targetRole);
    setSchedTargetType(alert.targetIds === "all" ? "all" : "custom");
    if (alert.targetIds !== "all") {
      setSchedSelectedUserIds(alert.targetIds.split(",").map((s: string) => s.trim()));
    } else {
      setSchedSelectedUserIds([]);
    }
    setSchedTime(alert.scheduledTime);
    setSchedType(alert.alertType);
    if (alert.alertType === "once") {
      setSchedDate(alert.scheduledDate || "");
      setSchedDays([]);
    } else {
      setSchedDate("");
      setSchedDays(alert.daysOfWeek ? alert.daysOfWeek.split(",") : []);
    }
    setSchedTitle(alert.customTitle || "");
    setSchedBody(alert.customBody || "");
    setSchedShowWhatsapp(!!alert.showWhatsapp);
    setSchedShowOpenApp(!!alert.showOpenApp);
    setSchedShowDismiss(!!alert.showDismiss);
    setSchedTheme(alert.theme || "red");
    
    // سحب الواجهة للأعلى للوصول للنموذج
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info(`أنت الآن تقوم بتعديل التنبيه المجدول لـ ${alert.targetRole === "mandob" ? "المندوب" : alert.targetRole === "preparer" ? "المجهز" : "الموظف"}`);
  };

  const resetForm = () => {
    setEditingRecordId(null);
    setSchedTitle("");
    setSchedBody("");
    setSchedSelectedUserIds([]);
    setSchedTargetType("all");
    setSchedTime("08:00");
    setSchedType("recurring");
    setSchedDays(["0", "1", "2", "3", "4", "5", "6"]);
    setSchedDate("");
    setSchedTheme("red");
    setSchedShowDismiss(true);
    setSchedShowWhatsapp(false);
    setSchedShowOpenApp(false);
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
        if (editingRecordId === recordId) {
          resetForm();
        }
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
    <div className="space-y-6 text-gray-200">
      
      {/* التبويبات الرئيسية العلوية: ستايل مستقبلي نيون */}
      <div className="flex bg-slate-950/80 p-1.5 rounded-2xl gap-2 border border-slate-800/80 shadow-[0_0_20px_rgba(59,130,246,0.15)] backdrop-blur-md">
        <button
          onClick={() => setMainTab("instant")}
          className={`flex-1 py-4 text-center font-black text-sm rounded-xl transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
            mainTab === "instant"
              ? "bg-gradient-to-r from-red-950/80 to-rose-900/60 text-red-400 border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
              : "text-gray-400 hover:text-gray-200 hover:bg-slate-900/30"
          }`}
        >
          <span className="text-base">🚨</span>
          <span className="tracking-wide">نظام البث الفوري</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono border border-red-500/30 animate-pulse">LIVE</span>
        </button>
        <button
          onClick={() => setMainTab("scheduled")}
          className={`flex-1 py-4 text-center font-black text-sm rounded-xl transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
            mainTab === "scheduled"
              ? "bg-gradient-to-r from-blue-950/80 to-cyan-900/60 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
              : "text-gray-400 hover:text-gray-200 hover:bg-slate-900/30"
          }`}
        >
          <span className="text-base">📅</span>
          <span className="tracking-wide">التنبيه المؤقت المجدول</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono border border-cyan-500/30">SYS-AUTO</span>
        </button>
      </div>

      {mainTab === "instant" ? (
        // واجهة البث الفوري بلمسات مستقبلية
        <div className="space-y-6 animate-fadeIn">
          {error && (
            <div className="p-4 bg-red-950/40 border border-red-800/80 text-red-400 rounded-xl text-sm font-semibold shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              ⚠️ [SYS-ERR]: {error}
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 text-emerald-400 rounded-xl text-sm font-semibold shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              ✓ [SYS-SUCCESS]: {successMessage}
            </div>
          )}

          {/* شاشة حالة التنبيه النشطة */}
          {alertingState.isAlerting && (
            <div className="p-8 bg-gradient-to-b from-red-950/40 to-slate-950/60 border border-red-500/50 rounded-2xl flex flex-col items-center justify-center text-center space-y-5 shadow-2xl shadow-red-950/60 animate-pulse">
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-20 w-20 rounded-full bg-red-600/30 animate-ping"></span>
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white font-bold text-2xl shadow-[0_0_25px_rgba(220,38,38,0.8)] border border-red-500">
                  🚨
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-red-500 tracking-wider">[جاري إرسال واستقبال التنبيه...]</h3>
                <p className="text-sm text-red-400/90 max-w-lg font-semibold leading-relaxed">
                  تم إطلاق التنبيه الصوتي المستمر واهتزاز الأجهزة. ننتظر الآن استجابة أحد المستخدمين لكتم الرنين.
                </p>
                <div className="inline-block px-4 py-1.5 bg-slate-900 border border-red-900/60 rounded-full text-xs text-amber-500 font-mono mt-2">
                  COUNTDOWN: {alertingState.timeLeft}s
                </div>
              </div>

              <button
                onClick={() => handleTriggerAlert("stop")}
                disabled={loading}
                className="px-10 py-3.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold rounded-xl shadow-lg shadow-red-900/40 hover:scale-105 active:scale-95 transition-all duration-300 border border-red-500/30 cursor-pointer"
              >
                {loading ? "جاري الإيقاف..." : "⏹️ إيقاف التنبيه الآن"}
              </button>
            </div>
          )}

          {/* شاشة استجابة المستخدم الناجحة */}
          {respondedName && (
            <div className="p-8 bg-gradient-to-b from-emerald-950/40 to-slate-950/60 border border-emerald-500/50 rounded-2xl flex flex-col items-center justify-center text-center space-y-5 shadow-2xl shadow-emerald-950/60">
              <div className="relative">
                <span className="absolute inline-flex h-24 w-24 rounded-full bg-emerald-600/20 animate-ping"></span>
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-3xl shadow-[0_0_25px_rgba(16,185,129,0.8)] border border-emerald-500">
                  ✓
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-emerald-400">[تمت الاستجابة وتأكيد الكتم]</h3>
                <p className="text-base text-gray-200 max-w-lg leading-relaxed font-semibold">
                  قام {respondedRole === "mandob" ? "المندوب" : respondedRole === "preparer" ? "المجهز" : "الموظف"} <span className="text-emerald-400 underline font-bold">{respondedName}</span> بفتح التنبيه وتأكيد استلامه، وجاري توجيهه لمراسلتك عبر الواتساب.
                </p>
              </div>

              <button
                onClick={() => {
                  setRespondedName(null);
                  setRespondedRole(null);
                  setSuccessMessage(null);
                }}
                className="px-10 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg border border-emerald-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                العودة للوحة التحكم
              </button>
            </div>
          )}

          {/* تصنيف الفئات والبحث بلمسة مستقبلية */}
          {!alertingState.isAlerting && !respondedName && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/40 shadow-inner">
              <div className="md:col-span-2 flex gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab("mandob")}
                  className={`flex-1 py-2.5 text-center font-bold text-xs rounded-lg transition-all cursor-pointer ${
                    activeTab === "mandob"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  🛵 المندوبين ({couriers.length})
                </button>
                <button
                  onClick={() => setActiveTab("preparer")}
                  className={`flex-1 py-2.5 text-center font-bold text-xs rounded-lg transition-all cursor-pointer ${
                    activeTab === "preparer"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  📦 المجهزين ({preparers.length})
                </button>
                <button
                  onClick={() => setActiveTab("employee")}
                  className={`flex-1 py-2.5 text-center font-bold text-xs rounded-lg transition-all cursor-pointer ${
                    activeTab === "employee"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  💼 الموظفين ({employees.length})
                </button>
              </div>

              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="البحث عن اسم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-all font-semibold"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 text-gray-500 hover:text-gray-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* قائمة الأسماء المستهدفة */}
          {!alertingState.isAlerting && !respondedName && (
            <div className="border border-slate-850 rounded-2xl bg-slate-950/20 overflow-hidden shadow-lg shadow-slate-950/50 backdrop-blur-sm">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-950/60 border-b border-slate-850">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer"
                >
                  {filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.includes(u.id))
                    ? "✕ إلغاء تحديد الكل"
                    : "✓ تحديد جميع الأسماء المفلترة"}
                </button>
                <span className="text-xs text-gray-400 font-mono">
                  SELECTED: {selectedIds.length} / {filteredUsers.length}
                </span>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-sm">
                  لا توجد أسماء مطابقة لعملية البحث.
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-850/60">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedIds.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user.id)}
                        className={`flex items-center gap-3.5 px-5 py-3.5 cursor-pointer hover:bg-slate-900/30 transition-colors ${
                          isSelected ? "bg-red-500/5" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="pointer-events-none rounded border-slate-700 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 w-4.5 h-4.5"
                        />
                        <div className="flex-1">
                          <span className={`font-semibold text-sm transition-colors ${isSelected ? "text-red-400" : "text-gray-300"}`}>
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

          {/* تخصيص التنبيه الفوري */}
          {!alertingState.isAlerting && !respondedName && (
            <div className="p-6 border border-slate-850 rounded-2xl bg-slate-950/40 space-y-5 shadow-lg">
              <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 border-b border-slate-850 pb-2.5">
                ⚙️ تخصيص نصوص وأزرار ومظهر التنبيه
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-semibold block">العنوان المخصص (أو اتركه فارغاً للتمويه):</label>
                  <input
                    type="text"
                    placeholder="مثال: أذكار الصباح..."
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-red-500 transition-colors text-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-semibold block">نص التنبيه المخصص (أو اتركه فارغاً للتمويه):</label>
                  <input
                    type="text"
                    placeholder="مثال: يرجى قراءة أذكار الصباح..."
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-red-500 transition-colors text-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-semibold block">ستايل التنبيه (المظهر):</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-red-500 cursor-pointer text-gray-200"
                  >
                    <option value="red">🚨 تنبيه أحمر كلاسيكي (محسّن)</option>
                    <option value="islamic">🕌 أذكار / إسلامي (أخضر وذهبي)</option>
                    <option value="official">💼 رسمي / إداري (كحلي ملكي)</option>
                    <option value="sport">⚡ نشاط / رياضي (برتقالي دافئ)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-2 border-t border-slate-850/60 pt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showDismiss}
                    onChange={(e) => setShowDismiss(e.target.checked)}
                    className="rounded border-slate-700 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر إغلاق التنبيه المعتاد</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showWhatsapp}
                    onChange={(e) => setShowWhatsapp(e.target.checked)}
                    className="rounded border-slate-700 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر مراسلة الواتساب (إيقاف ومراسلة)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showOpenApp}
                    onChange={(e) => setShowOpenApp(e.target.checked)}
                    className="rounded border-slate-700 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر فتح التطبيق (اختياري)</span>
                </label>
              </div>
            </div>
          )}

          {/* إطلاق التنبيه */}
          {!alertingState.isAlerting && !respondedName && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => handleTriggerAlert("start")}
                disabled={loading || selectedIds.length === 0}
                className={`relative px-16 py-5 rounded-2xl font-black text-lg text-white shadow-2xl transition-all duration-300 transform border cursor-pointer hover:scale-105 active:scale-[0.98] ${
                  selectedIds.length > 0
                    ? "bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 border-red-400 shadow-[0_0_30px_rgba(220,38,38,0.4)] animate-pulse"
                    : "bg-slate-900 text-gray-600 border-slate-800 cursor-not-allowed shadow-none"
                }`}
              >
                {loading ? (
                  "جاري إرسال البث..."
                ) : (
                  <span className="flex items-center gap-2">
                    <span>إطلاق البث الفوري الآن</span>
                    <span>🚨</span>
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        // واجهة التنبيه المجدول المزدانة بستايل مستقبلي تكنولوجي
        <div className="space-y-8 animate-fadeIn">
          
          {/* قسم إعداد التنبيه المجدول */}
          <div className="p-6 border border-slate-800 rounded-2xl bg-slate-950/70 space-y-6 shadow-xl shadow-slate-950/60 backdrop-blur-md relative overflow-hidden">
            {/* شريط زينة نيون في الأعلى */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>

            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="text-base font-black text-cyan-400 flex items-center gap-2">
                <span>[⚙️ SYSTEM-SCHEDULER]</span>
                <span>{editingRecordId ? "تعديل التنبيه المجدول الحالي" : "جدولة وضبط تنبيه مؤقت جديد"}</span>
              </h3>
              {editingRecordId && (
                <button
                  onClick={resetForm}
                  className="px-3 py-1 bg-red-950/40 hover:bg-red-900/30 border border-red-900 text-red-400 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  ✕ إلغاء التعديل
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. الفئة المستهدفة */}
              <div className="space-y-2.5">
                <label className="text-xs text-cyan-400/80 font-mono tracking-wider block font-bold">01 // TARGET_ROLE</label>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-850">
                  <button
                    type="button"
                    onClick={() => setSchedRole("mandob")}
                    className={`flex-1 py-2.5 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
                      schedRole === "mandob" ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/40" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    🛵 مندوب
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedRole("preparer")}
                    className={`flex-1 py-2.5 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
                      schedRole === "preparer" ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/40" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    📦 مجهز
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedRole("employee")}
                    className={`flex-1 py-2.5 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
                      schedRole === "employee" ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/40" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    💼 موظف
                  </button>
                </div>
              </div>

              {/* 2. اختيار الأسماء */}
              <div className="space-y-2.5">
                <label className="text-xs text-cyan-400/80 font-mono tracking-wider block font-bold">02 // USER_SCOPE</label>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-850">
                  <button
                    type="button"
                    onClick={() => setSchedTargetType("all")}
                    className={`flex-1 py-2.5 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
                      schedTargetType === "all" ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/40" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    📢 جميع الفئة
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedTargetType("custom")}
                    className={`flex-1 py-2.5 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
                      schedTargetType === "custom" ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/40" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    🎯 تحديد أسماء
                  </button>
                </div>
              </div>

              {/* 3. وقت التنبيه */}
              <div className="space-y-2.5">
                <label className="text-xs text-cyan-400/80 font-mono tracking-wider block font-bold">03 // TRIGGER_TIME (Baghdad)</label>
                <input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-slate-900 border border-slate-850 rounded-xl text-sm text-cyan-400 font-black font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                />
              </div>
            </div>

            {/* سياق اختيار الأسماء المحددة */}
            {schedTargetType === "custom" && (
              <div className="space-y-2 border border-slate-850 p-4.5 rounded-2xl bg-slate-950/30 backdrop-blur-sm animate-fadeIn">
                <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-800">
                  <span className="text-xs text-gray-400 font-semibold">تحديد مستخدمين من الفئة المذكورة:</span>
                  <div className="relative max-w-xs flex-1">
                    <input
                      type="text"
                      placeholder="البحث عن اسم..."
                      value={schedSearchQuery}
                      onChange={(e) => setSchedSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-850 rounded-lg text-xs focus:outline-none focus:border-cyan-500 text-gray-200"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-1.5 text-xs text-gray-400">
                  <button
                    type="button"
                    onClick={handleSelectAllSched}
                    className="text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
                  >
                    {filteredSchedUsers.length > 0 && filteredSchedUsers.every((u) => schedSelectedUserIds.includes(u.id))
                      ? "✕ إلغاء تحديد الكل"
                      : "✓ تحديد الكل المفلتر"}
                  </button>
                  <span className="font-mono">SELECTED: {schedSelectedUserIds.length} / {filteredSchedUsers.length}</span>
                </div>

                {filteredSchedUsers.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-xs">
                    لا توجد أسماء مطابقة لعملية البحث.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-850/30 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-1">
                    {filteredSchedUsers.map((user) => {
                      const isSelected = schedSelectedUserIds.includes(user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => handleSelectSchedUser(user.id)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-900/50 transition-all border ${
                            isSelected ? "bg-cyan-950/10 border-cyan-800/40" : "border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="pointer-events-none rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900 w-4 h-4"
                          />
                          <span className={`text-xs font-semibold ${isSelected ? "text-cyan-400" : "text-gray-300"}`}>
                            {user.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* الجدولة والتكرار */}
            <div className="p-5 border border-slate-850 rounded-2xl bg-slate-900/30 space-y-4">
              <div className="flex items-center gap-8 border-b border-slate-850 pb-3">
                <span className="text-xs text-cyan-400/80 font-mono tracking-wider font-bold block">04 // SCHEDULING_TYPE</span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="schedType"
                    checked={schedType === "recurring"}
                    onChange={() => setSchedType("recurring")}
                    className="text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-200 font-bold">تكرار أسبوعي</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="schedType"
                    checked={schedType === "once"}
                    onChange={() => setSchedType("once")}
                    className="text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-200 font-bold">مرة واحدة فقط</span>
                </label>
              </div>

              {schedType === "once" ? (
                <div className="space-y-2 max-w-xs animate-fadeIn">
                  <label className="text-xs text-gray-400 font-semibold">اختر تاريخ التنبيه:</label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-cyan-500 transition-colors text-gray-200"
                  />
                </div>
              ) : (
                <div className="space-y-3 animate-fadeIn">
                  <label className="text-xs text-gray-400 font-semibold block">حدد أيام الأسبوع لتكرار البث:</label>
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
                          className={`px-4.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? "bg-cyan-600 border-cyan-500 text-white shadow-md shadow-cyan-900/30 scale-[1.03]"
                              : "bg-slate-900 border-slate-850 text-gray-400 hover:border-slate-700"
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

            {/* نصوص وتصميم التنبيه */}
            <div className="p-5 border border-slate-850 rounded-2xl bg-slate-900/30 space-y-4">
              <span className="text-xs text-cyan-400/80 font-mono tracking-wider font-bold block">05 // ALERT_PROPERTIES</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-semibold block">العنوان المخصص (أو اتركه فارغاً للتمويه):</label>
                  <input
                    type="text"
                    placeholder="مثال: أذكار الصباح..."
                    value={schedTitle}
                    onChange={(e) => setSchedTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-cyan-500 transition-colors text-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-semibold block">نص التنبيه المخصص (أو اتركه فارغاً للتمويه):</label>
                  <input
                    type="text"
                    placeholder="مثال: حان الآن وقت الأذكار..."
                    value={schedBody}
                    onChange={(e) => setSchedBody(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-cyan-500 transition-colors text-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-semibold block">ستايل التنبيه (المظهر):</label>
                  <select
                    value={schedTheme}
                    onChange={(e) => setSchedTheme(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-cyan-500 cursor-pointer text-gray-200"
                  >
                    <option value="red">🚨 تنبيه أحمر كلاسيكي (محسّن)</option>
                    <option value="islamic">🕌 أذكار / إسلامي (أخضر وذهبي)</option>
                    <option value="official">💼 رسمي / إداري (كحلي ملكي)</option>
                    <option value="sport">⚡ نشاط / رياضي (برتقالي دافئ)</option>
                  </select>
                </div>
              </div>

              {/* أزرار تفاعل التنبيه */}
              <div className="flex flex-wrap gap-6 pt-3 border-t border-slate-850/60">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedShowDismiss}
                    onChange={(e) => setSchedShowDismiss(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر إغلاق التنبيه المعتاد</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedShowWhatsapp}
                    onChange={(e) => setSchedShowWhatsapp(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر مراسلة الواتساب (إيقاف ومراسلة)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedShowOpenApp}
                    onChange={(e) => setSchedShowOpenApp(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900 w-4.5 h-4.5"
                  />
                  <span className="text-xs text-gray-300 font-semibold">إظهار زر فتح التطبيق (اختياري)</span>
                </label>
              </div>
            </div>

            {/* أزرار الحفظ أو تحديث الحفظ */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleSaveScheduledAlert}
                disabled={loading}
                className={`px-12 py-4 rounded-xl font-black text-sm text-white shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  editingRecordId
                    ? "bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 border border-orange-500/30 shadow-orange-950/20"
                    : "bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 border border-cyan-500/30 shadow-cyan-950/20"
                }`}
              >
                {loading ? (
                  "جاري المعالجة..."
                ) : (
                  <>
                    <span>{editingRecordId ? "💾 تحديث وحفظ التعديلات" : "💾 جدولة وحفظ التنبيه"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* قائمة التنبيهات المجدولة */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-base font-bold text-gray-200 flex items-center gap-2">
                <span>📋 قائمة التنبيهات المجدولة والنشطة</span>
                <span className="px-2 py-0.5 text-xs rounded bg-slate-900 border border-slate-850 font-mono text-cyan-400">{scheduledAlerts.length}</span>
              </h3>
            </div>

            {scheduledAlerts.length === 0 ? (
              <div className="p-10 border border-slate-850 rounded-2xl bg-slate-950/20 text-center text-gray-500 text-sm">
                لا توجد أي تنبيهات مؤقتة مجدولة حالياً.
              </div>
            ) : (
              <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950/50 shadow-xl backdrop-blur-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="bg-slate-950/90 text-gray-400 border-b border-slate-800 font-bold">
                        <th className="px-5 py-3.5">المستهدفون</th>
                        <th className="px-5 py-3.5">الوقت (العراق)</th>
                        <th className="px-5 py-3.5">الجدولة والتكرار</th>
                        <th className="px-5 py-3.5">مواصفات الشاشة</th>
                        <th className="px-5 py-3.5">الحالة</th>
                        <th className="px-5 py-3.5 text-center">إجراءات التحكم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60">
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

                        const isBeingEdited = editingRecordId === alert.recordId;

                        return (
                          <tr 
                            key={alert.recordId} 
                            className={`hover:bg-slate-900/10 transition-colors ${
                              isBeingEdited ? "bg-cyan-950/10 border-y border-cyan-800/30" : ""
                            }`}
                          >
                            {/* المستهدف */}
                            <td className="px-5 py-4">
                              <div className="font-bold text-gray-200">{roleLabel}</div>
                              <div className="text-xs text-gray-400 mt-1 font-mono">{targetLabel}</div>
                            </td>
                            {/* الوقت */}
                            <td className="px-5 py-4 font-mono font-black text-cyan-400 text-sm">
                              {formatTime12Hr(alert.scheduledTime)}
                            </td>
                            {/* الجدولة */}
                            <td className="px-5 py-4 text-xs font-semibold">
                              {alert.alertType === "once" ? (
                                <span className="text-amber-400 bg-amber-950/30 px-2.5 py-1.5 rounded-lg border border-amber-900/40">
                                  مرة واحدة: {alert.scheduledDate}
                                </span>
                              ) : (
                                <span className="text-emerald-400 bg-emerald-950/30 px-2.5 py-1.5 rounded-lg border border-emerald-900/40 block leading-relaxed max-w-[200px]">
                                  تكرار: {formatDays(alert.daysOfWeek)}
                                </span>
                              )}
                            </td>
                            {/* التفاصيل */}
                            <td className="px-5 py-4 text-xs space-y-1.5">
                              <div className="font-bold text-gray-300">
                                العنوان: {alert.customTitle || <span className="text-gray-500 italic">فارغ (مموه)</span>}
                              </div>
                              <div className="text-gray-455">
                                النص: {alert.customBody || <span className="text-gray-500 italic">فارغ (مموه)</span>}
                              </div>
                              <div className="flex gap-1.5 flex-wrap pt-0.5">
                                <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-gray-400 border border-slate-800">
                                  ستايل: {alert.theme === "red" ? "أحمر" : alert.theme === "islamic" ? "إسلامي" : alert.theme === "official" ? "رسمي" : "رياضي"}
                                </span>
                                {alert.showDismiss && (
                                  <span className="bg-red-950/15 px-1.5 py-0.5 rounded text-[10px] text-red-400 border border-red-900/30">
                                    زر الإغلاق
                                  </span>
                                )}
                                {alert.showWhatsapp && (
                                  <span className="bg-emerald-950/15 px-1.5 py-0.5 rounded text-[10px] text-emerald-400 border border-emerald-900/30">
                                    إيقاف ومراسلة
                                  </span>
                                )}
                                {alert.showOpenApp && (
                                  <span className="bg-blue-950/15 px-1.5 py-0.5 rounded text-[10px] text-blue-400 border border-blue-900/30">
                                    زر التطبيق
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* الحالة */}
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => handleToggleScheduledAlert(alert.recordId, alert.isActive)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-black border transition-all duration-200 cursor-pointer ${
                                  alert.isActive
                                    ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/20"
                                    : "bg-red-950/30 text-red-400 border-red-800/60 hover:bg-red-900/20"
                                }`}
                              >
                                {alert.isActive ? "● مفعّل ونشط" : "○ معطّل مؤقتاً"}
                              </button>
                            </td>
                            {/* الإجراءات */}
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(alert)}
                                  disabled={isBeingEdited}
                                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                                    isBeingEdited
                                      ? "bg-slate-900 border-slate-800 text-gray-500 cursor-not-allowed"
                                      : "bg-amber-950/20 hover:bg-amber-900/30 border-amber-900/50 text-amber-400 hover:scale-105 active:scale-95"
                                  }`}
                                  title="تعديل الجدولة"
                                >
                                  ✏️ تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteScheduledAlert(alert.recordId)}
                                  className="px-3 py-2 bg-red-950/20 hover:bg-red-900/30 border border-red-900/50 text-red-400 text-xs font-bold rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  title="حذف الجدولة"
                                >
                                  🗑️ حذف
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
