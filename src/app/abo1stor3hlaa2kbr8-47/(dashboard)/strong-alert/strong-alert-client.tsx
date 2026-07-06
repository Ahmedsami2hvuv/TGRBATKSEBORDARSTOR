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

  // حالات سجل التنبيهات الفورية
  const [instantHistory, setInstantHistory] = useState<any[]>([]);

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

  // جلب التنبيهات عند تحميل الصفحة أو تبديل التبويب
  useEffect(() => {
    if (mainTab === "scheduled") {
      fetchScheduledAlerts();
    } else {
      fetchInstantHistory();
    }
  }, [mainTab]);

  const fetchInstantHistory = async () => {
    try {
      const response = await fetch("/api/admin/strong-alert?history=true", {
        headers: {
          "Authorization": `Bearer ${adminToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setInstantHistory(data.history || []);
      }
    } catch (e) {
      console.error("Error fetching instant alert history:", e);
      toast.error("فشل جلب سجل التنبيهات الفورية");
    }
  };

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
        fetchInstantHistory(); // جلب السجل بعد الإرسال الناجح
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

  const handleDeleteHistoryAlert = async (recordId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا التنبيه من السجل؟")) return;

    try {
      const response = await fetch(`/api/admin/strong-alert?recordId=${recordId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${adminToken}`,
        },
      });

      if (response.ok) {
        toast.success("تم حذف التنبيه من السجل بنجاح");
        fetchInstantHistory();
      } else {
        toast.error("فشل حذف التنبيه من السجل");
      }
    } catch (e) {
      toast.error("حدث خطأ أثناء حذف التنبيه");
    }
  };

  const handleRepeatAlert = async (alert: any) => {
    if (!confirm("هل تريد إعادة إرسال هذا التنبيه فوراً بنفس المستهدفين والإعدادات؟")) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const alertId = "alert_" + Date.now().toString() + "_" + Math.random().toString(36).substring(7);
      const targetIdsArray = alert.targetIds.split(",").map((id: string) => id.trim()).filter(Boolean);

      const response = await fetch("/api/admin/strong-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          action: "start",
          targetRole: alert.targetRole,
          userIds: targetIdsArray,
          alertId,
          customTitle: alert.customTitle,
          customBody: alert.customBody,
          showWhatsapp: alert.showWhatsapp,
          showOpenApp: alert.showOpenApp,
          showDismiss: alert.showDismiss,
          theme: alert.theme,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "فشل الاتصال بالخادم");
      }

      setRespondedName(null);
      setRespondedRole(null);
      setAlertingState({
        isAlerting: true,
        activeRole: alert.targetRole,
        activeUserIds: targetIdsArray,
        timeLeft: 60,
        alertId: alertId,
      });
      setSuccessMessage(`تم تكرار وإرسال التنبيه القوي بنجاح!`);
      fetchInstantHistory();
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAlertToForm = (alert: any) => {
    setActiveTab(alert.targetRole);
    setCustomTitle(alert.customTitle || "");
    setCustomBody(alert.customBody || "");
    setTheme(alert.theme || "red");
    setShowDismiss(alert.showDismiss !== false);
    setShowWhatsapp(!!alert.showWhatsapp);
    setShowOpenApp(!!alert.showOpenApp);
    
    const targetIdsArray = alert.targetIds.split(",").map((id: string) => id.trim()).filter(Boolean);
    setSelectedIds(targetIdsArray);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info("تم تحميل إعدادات ومستهدفي التنبيه إلى النموذج بنجاح!");
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
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info(`تعديل التنبيه المجدول لـ ${alert.targetRole === "mandob" ? "المندوب" : alert.targetRole === "preparer" ? "المجهز" : "الموظف"}`);
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

  // دالة لجلب أسماء الأشخاص المحددين بدقة لعرضها للأدمن
  const getTargetNames = (targetRole: string, targetIds: string) => {
    if (targetIds === "all") return "جميع أسماء الفئة";
    const ids = targetIds.split(",").map(id => id.trim()).filter(Boolean);
    const allUsers = [...couriers, ...preparers, ...employees];
    const names = ids.map(id => {
      const user = allUsers.find(u => u.id === id);
      return user ? user.name : "مستخدم غير معروف";
    });
    return names.join("، ");
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
    // الخلفية بأكملها تم تغييرها لتصبح زجاجية مبهجة ومريحة تفتح النفس
    <div className="min-h-screen bg-gradient-to-tr from-sky-100 via-indigo-50 to-pink-100 text-slate-800 p-6 md:p-8 rounded-3xl border border-white/60 shadow-[0_10px_50px_rgba(148,163,184,0.15)] relative overflow-hidden space-y-6">
      
      {/* شبكة خلفية ناعمة ومبهجة */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#fff_70%,transparent_100%)] opacity-40 pointer-events-none"></div>
      
      {/* زينة علوية مبهجة وناعمة */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-indigo-400 via-pink-400 to-orange-400"></div>

      {/* الهيدر المبهج والزجاجي للمنظومة */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-black tracking-wider text-slate-800 flex items-center gap-2">
            <span>🚨 مركز التحكم بنظام التنبيهات</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 font-semibold">
            لوحة تحكم إرسال الاستدعاءات العاجلة والجدولة الزمنية التلقائية بتوقيت العراق المحلي.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-white/70 border border-white/60 rounded-xl text-xs font-bold text-sky-600 shadow-sm backdrop-blur-md">
            الحالة: متصل بالخادم
          </div>
          <div className="px-3.5 py-1.5 bg-white/70 border border-white/60 rounded-xl text-xs font-bold text-amber-600 shadow-sm backdrop-blur-md">
            توقيت بغداد (GMT+3)
          </div>
        </div>
      </div>

      {/* التبويبات الرئيسية العلوية: ستايل زجاجي مريح وأنيق */}
      <div className="relative z-10 flex bg-white/50 p-1.5 rounded-2xl gap-2 border border-white/60 shadow-lg shadow-slate-200/50 backdrop-blur-md">
        <button
          onClick={() => setMainTab("instant")}
          className={`flex-1 py-4 text-center font-black text-sm rounded-xl transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
            mainTab === "instant"
              ? "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/20 border border-rose-400/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
          }`}
        >
          <span className="text-base">🚨</span>
          <span className="tracking-wide">نظام البث الفوري</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 text-white font-bold border border-white/30 animate-pulse">مباشر</span>
        </button>
        <button
          onClick={() => setMainTab("scheduled")}
          className={`flex-1 py-4 text-center font-black text-sm rounded-xl transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
            mainTab === "scheduled"
              ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/20 border border-sky-400/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
          }`}
        >
          <span className="text-base">📅</span>
          <span className="tracking-wide">التنبيه المؤقت المجدول</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 text-white font-bold border border-white/30">جدولة</span>
        </button>
      </div>

      {mainTab === "instant" ? (
        // واجهة البث الفوري
        <div className="relative z-10 space-y-6 animate-fadeIn">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-semibold shadow-sm">
              ⚠️ [حدث خطأ في النظام]: {error}
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-700 rounded-xl text-sm font-semibold shadow-sm">
              ✓ [نجاح العملية]: {successMessage}
            </div>
          )}

          {/* شاشة حالة التنبيه النشطة */}
          {alertingState.isAlerting && (
            <div className="p-8 bg-gradient-to-b from-rose-50/80 to-white/90 border border-rose-300 rounded-2xl flex flex-col items-center justify-center text-center space-y-5 shadow-xl shadow-rose-100/50 backdrop-blur-md animate-pulse">
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-20 w-20 rounded-full bg-rose-500/30 animate-ping"></span>
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white font-bold text-2xl border border-rose-400 shadow-lg">
                  🚨
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-rose-600 tracking-wider">[جاري إرسال واستقبل التنبيه...]</h3>
                <p className="text-sm text-slate-500 max-w-lg font-semibold leading-relaxed">
                  تم إطلاق التنبيه الصوتي المستمر واهتزاز الأجهزة. ننتظر الآن استجابة أحد المستخدمين لكتم الرنين.
                </p>
                <div className="inline-block px-4 py-1.5 bg-white border border-rose-200 text-amber-600 rounded-full text-xs font-bold font-mono mt-2 shadow-sm">
                  وقت الانتظار المتبقي: {alertingState.timeLeft} ثانية
                </div>
              </div>

              <button
                onClick={() => handleTriggerAlert("stop")}
                disabled={loading}
                className="px-10 py-3.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-extrabold rounded-xl shadow-md shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all duration-300 border border-rose-400/20 cursor-pointer"
              >
                {loading ? "جاري الإيقاف..." : "⏹️ إيقاف التنبيه الآن"}
              </button>
            </div>
          )}

          {/* شاشة استجابة المستخدم الناجحة */}
          {respondedName && (
            <div className="p-8 bg-gradient-to-b from-emerald-50/80 to-white/90 border border-emerald-300 rounded-2xl flex flex-col items-center justify-center text-center space-y-5 shadow-xl shadow-emerald-100/50 backdrop-blur-md">
              <div className="relative">
                <span className="absolute inline-flex h-24 w-24 rounded-full bg-emerald-600/20 animate-ping"></span>
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-3xl border border-emerald-400 shadow-md">
                  ✓
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-emerald-600">[تمت الاستجابة وتأكيد الكتم]</h3>
                <p className="text-base text-slate-700 max-w-lg leading-relaxed font-semibold">
                  قام {respondedRole === "mandob" ? "المندوب" : respondedRole === "preparer" ? "المجهز" : "الموظف"} <span className="text-emerald-600 underline font-bold">{respondedName}</span> بفتح التنبيه وتأكيد استلامه، وجاري توجيهه لمراسلتك عبر الواتساب.
                </p>
              </div>

              <button
                onClick={() => {
                  setRespondedName(null);
                  setRespondedRole(null);
                  setSuccessMessage(null);
                }}
                className="px-10 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md border border-emerald-500/20 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                العودة للوحة التحكم
              </button>
            </div>
          )}

          {/* تصنيف الفئات والبحث */}
          {!alertingState.isAlerting && !respondedName && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/50 p-3 rounded-2xl border border-white/60 shadow-sm backdrop-blur-md">
              <div className="md:col-span-2 flex gap-1 p-1 bg-slate-100/70 rounded-xl border border-slate-200/80">
                <button
                  onClick={() => setActiveTab("mandob")}
                  className={`flex-1 py-2.5 text-center font-bold text-xs rounded-lg transition-all cursor-pointer ${
                    activeTab === "mandob"
                      ? "bg-white text-rose-600 border border-slate-200 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  🛵 المندوبين ({couriers.length})
                </button>
                <button
                  onClick={() => setActiveTab("preparer")}
                  className={`flex-1 py-2.5 text-center font-bold text-xs rounded-lg transition-all cursor-pointer ${
                    activeTab === "preparer"
                      ? "bg-white text-rose-600 border border-slate-200 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  📦 المجهزين ({preparers.length})
                </button>
                <button
                  onClick={() => setActiveTab("employee")}
                  className={`flex-1 py-2.5 text-center font-bold text-xs rounded-lg transition-all cursor-pointer ${
                    activeTab === "employee"
                      ? "bg-white text-rose-600 border border-slate-200 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
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
                  className="w-full px-4.5 py-2.5 bg-white/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/20 transition-all font-semibold text-slate-800 placeholder-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* قائمة الأسماء المستهدفة */}
          {!alertingState.isAlerting && !respondedName && (
            <div className="border border-slate-200 rounded-2xl bg-white/40 overflow-hidden shadow-md backdrop-blur-sm">
              <div className="flex items-center justify-between px-5 py-4 bg-white/80 border-b border-slate-200">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-rose-600 hover:text-rose-500 font-bold transition-colors cursor-pointer"
                >
                  {filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.includes(u.id))
                    ? "✕ إلغاء تحديد الكل"
                    : "✓ تحديد جميع الأسماء المفلترة"}
                </button>
                <span className="text-xs text-slate-500 font-bold">
                  تم تحديد: {selectedIds.length} من {filteredUsers.length}
                </span>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  لا توجد أسماء مطابقة لعملية البحث.
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedIds.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user.id)}
                        className={`flex items-center gap-3.5 px-5 py-3.5 cursor-pointer hover:bg-slate-50/50 transition-colors ${
                          isSelected ? "bg-rose-50/60" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="pointer-events-none rounded border-slate-350 text-rose-500 focus:ring-rose-500 focus:ring-offset-white w-4.5 h-4.5"
                        />
                        <div className="flex-1">
                          <span className={`font-semibold text-sm transition-colors ${isSelected ? "text-rose-600 font-bold" : "text-slate-700"}`}>
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
            <div className="p-6 border border-slate-200 rounded-2xl bg-white/60 space-y-5 shadow-sm backdrop-blur-sm">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2.5">
                ⚙️ تخصيص نصوص وأزرار ومظهر التنبيه
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 font-semibold block">العنوان المخصص (أو اتركه فارغاً للتمويه):</label>
                  <input
                    type="text"
                    placeholder="مثال: أذكار الصباح..."
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500 transition-colors text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 font-semibold block">نص التنبيه المخصص (أو اتركه فارغاً للتمويه):</label>
                  <input
                    type="text"
                    placeholder="مثال: يرجى قراءة أذكار الصباح..."
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500 transition-colors text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 font-semibold block">ستايل التنبيه (المظهر):</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500 cursor-pointer text-slate-800"
                  >
                    <option value="red">🚨 تنبيه أحمر كلاسيكي (محسّن)</option>
                    <option value="islamic">🕌 أذكار / إسلامي (أخضر وذهبي)</option>
                    <option value="official">💼 رسمي / إداري (كحلي ملكي)</option>
                    <option value="sport">⚡ نشاط / رياضي (برتقالي دافئ)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showDismiss}
                    onChange={(e) => setShowDismiss(e.target.checked)}
                    className="rounded border-slate-350 text-rose-500 focus:ring-rose-500 focus:ring-offset-white w-4.5 h-4.5"
                  />
                  <span className="text-xs text-slate-700 font-semibold">إظهار زر إغلاق التنبيه المعتاد</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showWhatsapp}
                    onChange={(e) => setShowWhatsapp(e.target.checked)}
                    className="rounded border-slate-350 text-rose-500 focus:ring-rose-500 focus:ring-offset-white w-4.5 h-4.5"
                  />
                  <span className="text-xs text-slate-700 font-semibold">إظهار زر مراسلة الواتساب (راسل الاداره)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showOpenApp}
                    onChange={(e) => setShowOpenApp(e.target.checked)}
                    className="rounded border-slate-350 text-rose-500 focus:ring-rose-500 focus:ring-offset-white w-4.5 h-4.5"
                  />
                  <span className="text-xs text-slate-700 font-semibold">إظهار زر فتح التطبيق (اختياري)</span>
                </label>
              </div>
            </div>
          )}

          {/* زر إطلاق البث */}
          {!alertingState.isAlerting && !respondedName && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => handleTriggerAlert("start")}
                disabled={loading || selectedIds.length === 0}
                className={`relative px-16 py-5 rounded-2xl font-black text-lg text-white shadow-lg transition-all duration-300 transform border cursor-pointer hover:scale-105 active:scale-[0.98] ${
                  selectedIds.length > 0
                    ? "bg-gradient-to-r from-rose-500 via-pink-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 border-rose-400/20 shadow-[0_10px_25px_rgba(244,63,94,0.3)] animate-pulse"
                    : "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed shadow-none"
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

          {/* سجل التنبيهات الفورية */}
          {!alertingState.isAlerting && !respondedName && (
            <div className="space-y-4 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>📋 سجل البث الفوري السابق</span>
                  <span className="px-2 py-0.5 text-xs rounded bg-white border border-slate-200 font-mono text-rose-600 font-bold shadow-sm">
                    {instantHistory.length}
                  </span>
                </h3>
              </div>

              {instantHistory.length === 0 ? (
                <div className="p-10 border border-slate-200 rounded-2xl bg-white/40 text-center text-slate-400 text-sm">
                  لا توجد أي تنبيهات فورية مرسلة سابقاً في السجل.
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white/70 shadow-lg backdrop-blur-md">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold">
                          <th className="px-5 py-3.5">المستهدفون</th>
                          <th className="px-5 py-3.5">تاريخ الإرسال</th>
                          <th className="px-5 py-3.5">تفاصيل ومظهر الشاشة</th>
                          <th className="px-5 py-3.5 text-center">إجراءات التحكم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {instantHistory.map((alert) => {
                          const roleLabel =
                            alert.targetRole === "mandob"
                              ? "🛵 مندوب"
                              : alert.targetRole === "preparer"
                              ? "📦 مجهز"
                              : "💼 موظف";

                          return (
                            <tr key={alert.recordId} className="hover:bg-slate-50/40 transition-colors">
                              {/* المستهدف */}
                              <td className="px-5 py-4">
                                <div className="font-bold text-slate-800">{roleLabel}</div>
                                <div className="text-xs text-slate-500 mt-1 font-sans break-words max-w-[200px] font-semibold">
                                  {getTargetNames(alert.targetRole, alert.targetIds)}
                                </div>
                              </td>
                              {/* وقت الإرسال */}
                              <td className="px-5 py-4 font-mono text-slate-600 text-xs">
                                {new Date(alert.createdAt || alert.sentAt).toLocaleString("ar-IQ", {
                                  timeZone: "Asia/Baghdad",
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </td>
                              {/* التفاصيل */}
                              <td className="px-5 py-4 text-xs space-y-1.5">
                                <div className="font-bold text-slate-700">
                                  العنوان: {alert.customTitle || <span className="text-slate-400 italic">فارغ (مموه)</span>}
                                </div>
                                <div className="text-slate-600 font-semibold">
                                  النص: {alert.customBody || <span className="text-slate-400 italic">فارغ (مموه)</span>}
                                </div>
                                <div className="flex gap-1.5 flex-wrap pt-0.5">
                                  <span className="bg-slate-50 px-1.5 py-0.5 rounded text-[10px] text-slate-500 border border-slate-200">
                                    ستايل: {alert.theme === "red" ? "أحمر" : alert.theme === "islamic" ? "إسلامي" : alert.theme === "official" ? "رسمي" : "رياضي"}
                                  </span>
                                  {alert.showDismiss && (
                                    <span className="bg-rose-50 px-1.5 py-0.5 rounded text-[10px] text-rose-600 border border-rose-200">
                                      زر الإغلاق
                                    </span>
                                  )}
                                  {alert.showWhatsapp && (
                                    <span className="bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] text-emerald-600 border border-emerald-250">
                                      راسل الاداره
                                    </span>
                                  )}
                                  {alert.showOpenApp && (
                                    <span className="bg-blue-50 px-1.5 py-0.5 rounded text-[10px] text-blue-600 border border-blue-200">
                                      زر التطبيق
                                    </span>
                                  )}
                                </div>
                              </td>
                              {/* الإجراءات */}
                              <td className="px-5 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleRepeatAlert(alert)}
                                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 text-xs font-bold rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                                    title="تكرار البث فوراً"
                                  >
                                    🔁 تكرار
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleLoadAlertToForm(alert)}
                                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 text-xs font-bold rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                                    title="تعديل في النموذج"
                                  >
                                    ✏️ تعديل
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteHistoryAlert(alert.recordId)}
                                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                    title="حذف من السجل"
                                  >
                                    🗑️ مسح
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
          )}
        </div>
      ) : (
        // واجهة التنبيه المؤقت المجدول
        <div className="relative z-10 space-y-8 animate-fadeIn">
          
          {/* قسم إعداد التنبيه المجدول */}
          <div className="p-6 border border-white/60 rounded-2xl bg-white/60 space-y-6 shadow-xl shadow-slate-200/50 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-indigo-400 to-pink-400"></div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-sky-600 flex items-center gap-2">
                <span>📅 {editingRecordId ? "تعديل التنبيه المجدول الحالي" : "جدولة وضبط تنبيه مؤقت جديد"}</span>
              </h3>
              {editingRecordId && (
                <button
                  onClick={resetForm}
                  className="px-3 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  ✕ إلغاء التعديل
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. الفئة المستهدفة */}
              <div className="space-y-2.5">
                <label className="text-xs text-slate-500 font-bold block">1. الفئة المستهدفة:</label>
                <div className="flex bg-slate-100/70 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSchedRole("mandob")}
                    className={`flex-1 py-2.5 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
                      schedRole === "mandob" ? "bg-white text-sky-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    🛵 مندوب
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedRole("preparer")}
                    className={`flex-1 py-2.5 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
                      schedRole === "preparer" ? "bg-white text-sky-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    📦 مجهز
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedRole("employee")}
                    className={`flex-1 py-2.5 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
                      schedRole === "employee" ? "bg-white text-sky-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    💼 موظف
                  </button>
                </div>
              </div>

              {/* 2. اختيار الأسماء */}
              <div className="space-y-2.5">
                <label className="text-xs text-slate-500 font-bold block">2. نطاق الاختيار:</label>
                <div className="flex bg-slate-100/70 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSchedTargetType("all")}
                    className={`flex-1 py-2.5 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
                      schedTargetType === "all" ? "bg-white text-sky-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    📢 جميع الفئة
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedTargetType("custom")}
                    className={`flex-1 py-2.5 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
                      schedTargetType === "custom" ? "bg-white text-sky-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    🎯 تحديد أسماء
                  </button>
                </div>
              </div>

              {/* 3. وقت التنبيه */}
              <div className="space-y-2.5">
                <label className="text-xs text-slate-500 font-bold block">3. وقت التنبيه (توقيت العراق):</label>
                <input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-sky-600 font-black font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all"
                />
              </div>
            </div>

            {/* اختيار الأسماء */}
            {schedTargetType === "custom" && (
              <div className="space-y-2 border border-slate-200 p-4.5 rounded-2xl bg-white/40 backdrop-blur-sm animate-fadeIn">
                <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-200">
                  <span className="text-xs text-slate-600 font-bold">تحديد مستخدمين من الفئة المذكورة:</span>
                  <div className="relative max-w-xs flex-1">
                    <input
                      type="text"
                      placeholder="البحث عن اسم..."
                      value={schedSearchQuery}
                      onChange={(e) => setSchedSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-sky-500 text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-1.5 text-xs text-slate-500 font-bold">
                  <button
                    type="button"
                    onClick={handleSelectAllSched}
                    className="text-sky-600 hover:text-sky-500 font-bold cursor-pointer"
                  >
                    {filteredSchedUsers.length > 0 && filteredSchedUsers.every((u) => schedSelectedUserIds.includes(u.id))
                      ? "✕ إلغاء تحديد الكل"
                      : "✓ تحديد الكل المفلتر"}
                  </button>
                  <span>تم تحديد: {schedSelectedUserIds.length} من {filteredSchedUsers.length}</span>
                </div>

                {filteredSchedUsers.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    لا توجد أسماء مطابقة لعملية البحث.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-1">
                    {filteredSchedUsers.map((user) => {
                      const isSelected = schedSelectedUserIds.includes(user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => handleSelectSchedUser(user.id)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50/50 transition-all border ${
                            isSelected ? "bg-sky-50/60 border-sky-200/40" : "border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="pointer-events-none rounded border-slate-350 text-sky-500 focus:ring-sky-500 focus:ring-offset-white w-4 h-4"
                          />
                          <span className={`text-xs font-semibold ${isSelected ? "text-sky-600 font-bold" : "text-slate-750"}`}>
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
            <div className="p-5 border border-slate-200 rounded-2xl bg-white/45 space-y-4">
              <div className="flex items-center gap-8 border-b border-slate-200 pb-3">
                <span className="text-xs text-sky-600 font-bold block">4. نوع الجدولة والتكرار:</span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="schedType"
                    checked={schedType === "recurring"}
                    onChange={() => setSchedType("recurring")}
                    className="text-sky-500 focus:ring-sky-500 focus:ring-offset-white w-4.5 h-4.5"
                  />
                  <span className="text-xs text-slate-800 font-bold">تكرار أسبوعي</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="schedType"
                    checked={schedType === "once"}
                    onChange={() => setSchedType("once")}
                    className="text-sky-500 focus:ring-sky-500 focus:ring-offset-white w-4.5 h-4.5"
                  />
                  <span className="text-xs text-slate-800 font-bold">مرة واحدة فقط</span>
                </label>
              </div>

              {schedType === "once" ? (
                <div className="space-y-2 max-w-xs animate-fadeIn">
                  <label className="text-xs text-slate-500 font-semibold">اختر تاريخ التنبيه:</label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 transition-colors text-slate-800"
                  />
                </div>
              ) : (
                <div className="space-y-3 animate-fadeIn">
                  <label className="text-xs text-slate-500 font-semibold block">حدد أيام الأسبوع لتكرار البث:</label>
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
                              ? "bg-sky-500 border-sky-400 text-white shadow-md shadow-sky-500/20 scale-[1.03]"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-350"
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
            <div className="p-5 border border-slate-200 rounded-2xl bg-white/45 space-y-4">
              <span className="text-xs text-sky-600 font-bold block">5. خصائص ومظهر شاشة التنبيه:</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 font-semibold block">العنوان المخصص (أو اتركه فارغاً للتمويه):</label>
                  <input
                    type="text"
                    placeholder="مثال: أذكار الصباح..."
                    value={schedTitle}
                    onChange={(e) => setSchedTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 transition-colors text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 font-semibold block">نص التنبيه المخصص (أو اتركه فارغاً للتمويه):</label>
                  <input
                    type="text"
                    placeholder="مثال: حان الآن وقت الأذكار..."
                    value={schedBody}
                    onChange={(e) => setSchedBody(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 transition-colors text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 font-semibold block">ستايل التنبيه (المظهر):</label>
                  <select
                    value={schedTheme}
                    onChange={(e) => setSchedTheme(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 cursor-pointer text-slate-800"
                  >
                    <option value="red">🚨 تنبيه أحمر كلاسيكي (محسّن)</option>
                    <option value="islamic">🕌 أذكار / إسلامي (أخضر وذهبي)</option>
                    <option value="official">💼 رسمي / إداري (كحلي ملكي)</option>
                    <option value="sport">⚡ نشاط / رياضي (برتقالي دافئ)</option>
                  </select>
                </div>
              </div>

              {/* أزرار التفاعل */}
              <div className="flex flex-wrap gap-6 pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedShowDismiss}
                    onChange={(e) => setSchedShowDismiss(e.target.checked)}
                    className="rounded border-slate-350 text-sky-500 focus:ring-sky-500 focus:ring-offset-white w-4.5 h-4.5"
                  />
                  <span className="text-xs text-slate-700 font-semibold">إظهار زر إغلاق التنبيه المعتاد</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedShowWhatsapp}
                    onChange={(e) => setSchedShowWhatsapp(e.target.checked)}
                    className="rounded border-slate-350 text-sky-500 focus:ring-sky-500 focus:ring-offset-white w-4.5 h-4.5"
                  />
                  <span className="text-xs text-slate-700 font-semibold">إظهار زر مراسلة الواتساب (راسل الاداره)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedShowOpenApp}
                    onChange={(e) => setSchedShowOpenApp(e.target.checked)}
                    className="rounded border-slate-350 text-sky-500 focus:ring-sky-500 focus:ring-offset-white w-4.5 h-4.5"
                  />
                  <span className="text-xs text-slate-700 font-semibold">إظهار زر فتح التطبيق (اختياري)</span>
                </label>
              </div>
            </div>

            {/* الحفظ والتعديل */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleSaveScheduledAlert}
                disabled={loading}
                className={`px-12 py-4 rounded-xl font-black text-sm text-white shadow-md hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  editingRecordId
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 border border-orange-400/20 shadow-[0_4px_15px_rgba(245,158,11,0.2)]"
                    : "bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 border border-sky-400/20 shadow-[0_4px_15px_rgba(14,165,233,0.2)]"
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

          {/* جدول التنبيهات المجدولة */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>📋 قائمة التنبيهات المجدولة والنشطة</span>
                <span className="px-2 py-0.5 text-xs rounded bg-white border border-slate-200 font-mono text-sky-600 font-bold shadow-sm">{scheduledAlerts.length}</span>
              </h3>
            </div>

            {scheduledAlerts.length === 0 ? (
              <div className="p-10 border border-slate-200 rounded-2xl bg-white/40 text-center text-slate-400 text-sm">
                لا توجد أي تنبيهات مؤقتة مجدولة حالياً.
              </div>
            ) : (
              <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white/70 shadow-lg backdrop-blur-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold">
                        <th className="px-5 py-3.5">المستهدفون</th>
                        <th className="px-5 py-3.5">الوقت (العراق)</th>
                        <th className="px-5 py-3.5">الجدولة والتكرار</th>
                        <th className="px-5 py-3.5">مواصفات الشاشة</th>
                        <th className="px-5 py-3.5">الحالة</th>
                        <th className="px-5 py-3.5 text-center">إجراءات التحكم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scheduledAlerts.map((alert) => {
                        const roleLabel =
                          alert.targetRole === "mandob"
                            ? "🛵 مندوب"
                            : alert.targetRole === "preparer"
                            ? "📦 مجهز"
                            : "💼 موظف";

                        const isBeingEdited = editingRecordId === alert.recordId;

                        return (
                          <tr 
                            key={alert.recordId} 
                            className={`hover:bg-slate-50/40 transition-colors ${
                              isBeingEdited ? "bg-sky-50/50 border-y border-sky-200/40" : ""
                            }`}
                          >
                            {/* المستهدف */}
                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-800">{roleLabel}</div>
                              {/* هنا نعرض أسماء الأشخاص الفعليين بدقة بدلاً من محدد (1 شخص)! */}
                              <div className="text-xs text-slate-500 mt-1 font-sans break-words max-w-[200px] font-semibold">
                                {getTargetNames(alert.targetRole, alert.targetIds)}
                              </div>
                            </td>
                            {/* الوقت */}
                            <td className="px-5 py-4 font-mono font-black text-sky-600 text-sm">
                              {formatTime12Hr(alert.scheduledTime)}
                            </td>
                            {/* الجدولة */}
                            <td className="px-5 py-4 text-xs font-semibold">
                              {alert.alertType === "once" ? (
                                <span className="text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                                  مرة واحدة: {alert.scheduledDate}
                                </span>
                              ) : (
                                <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 block leading-relaxed max-w-[200px]">
                                  تكرار: {formatDays(alert.daysOfWeek)}
                                </span>
                              )}
                            </td>
                            {/* التفاصيل */}
                            <td className="px-5 py-4 text-xs space-y-1.5">
                              <div className="font-bold text-slate-700">
                                العنوان: {alert.customTitle || <span className="text-slate-400 italic">فارغ (مموه)</span>}
                              </div>
                              <div className="text-slate-600 font-semibold">
                                النص: {alert.customBody || <span className="text-slate-400 italic">فارغ (مموه)</span>}
                              </div>
                              <div className="flex gap-1.5 flex-wrap pt-0.5">
                                <span className="bg-slate-50 px-1.5 py-0.5 rounded text-[10px] text-slate-500 border border-slate-200">
                                  ستايل: {alert.theme === "red" ? "أحمر" : alert.theme === "islamic" ? "إسلامي" : alert.theme === "official" ? "رسمي" : "رياضي"}
                                </span>
                                {alert.showDismiss && (
                                  <span className="bg-rose-50 px-1.5 py-0.5 rounded text-[10px] text-rose-600 border border-rose-200">
                                    زر الإغلاق
                                  </span>
                                )}
                                {alert.showWhatsapp && (
                                  <span className="bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] text-emerald-600 border border-emerald-250">
                                    راسل الاداره
                                  </span>
                                )}
                                {alert.showOpenApp && (
                                  <span className="bg-blue-50 px-1.5 py-0.5 rounded text-[10px] text-blue-600 border border-blue-200">
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
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100/50"
                                    : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100/50"
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
                                      ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                      : "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-600 hover:scale-105 active:scale-95"
                                  }`}
                                  title="تعديل الجدولة"
                                >
                                  ✏️ تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteScheduledAlert(alert.recordId)}
                                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
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
