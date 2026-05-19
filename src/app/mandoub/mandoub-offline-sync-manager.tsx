"use client";

import { useEffect, useState, useRef } from "react";
import { getPendingActions, deletePendingAction, type PendingWalletAction } from "@/lib/mandoub-offline-db";
import {
  uploadShopDoorPhoto,
  bulkSetMandoubOrdersStatus,
  uploadMandoubOrderImageSubmit
} from "./actions";
import {
  submitMandoubPickupMoney,
  submitMandoubDeliveryMoney,
  submitMandoubMiscWalletEntry,
  softDeleteMandoubMiscWalletEntry,
  softDeleteMandoubMoneyEvent
} from "./cash-actions";
import { createWalletPeerTransferFromCourier } from "../wallet-peer-transfer-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { showTrayNotification } from "@/lib/client-web-notification";

export function MandoubOfflineSyncManager() {
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();
  const syncLock = useRef(false);

  const performSync = async () => {
    if (syncLock.current || !navigator.onLine) return;

    const actions = await getPendingActions();
    if (actions.length === 0) return;

    syncLock.current = true;
    setIsSyncing(true);
    const toastId = toast.loading(`جاري مزامنة ${actions.length} عمليات معلقة...`);

    let successCount = 0;
    let failCount = 0;

    for (const action of actions) {
      try {
        const formData = new FormData();
        Object.entries(action.formData).forEach(([k, v]) => formData.append(k, v));

        // إجبار الأكشن على عدم عمل Redirect أثناء المزامنة في الخلفية
        formData.append("noRedirect", "1");

        if (action.fileData) {
          const file = new File([action.fileData.blob], action.fileData.name, { type: action.fileData.type });
          // تحديد اسم الحقل بناءً على نوع العملية
          const fieldName = action.actionType === 'upload_shop_door' ? 'doorPhoto' : 'orderImage';
          formData.append(fieldName, file);
        }

        // توجيه العملية للأكشن المناسب
        switch (action.actionType) {
          case 'pickup':
            await submitMandoubPickupMoney({}, formData);
            break;
          case 'delivery':
            await submitMandoubDeliveryMoney({}, formData);
            break;
          case 'bulk_status':
            await bulkSetMandoubOrdersStatus({}, formData);
            break;
          case 'upload_shop_door':
            await uploadShopDoorPhoto({}, formData);
            break;
          case 'upload_order_image':
            await uploadMandoubOrderImageSubmit(formData);
            break;
          case 'submit_misc':
            await submitMandoubMiscWalletEntry({}, formData);
            break;
          case 'transfer':
            await createWalletPeerTransferFromCourier({}, formData);
            break;
          case 'delete_misc':
            await softDeleteMandoubMiscWalletEntry({}, formData);
            break;
          case 'delete_event':
            await softDeleteMandoubMoneyEvent({}, formData);
            break;
          // يمكن إضافة البقية هنا بنفس النمط
        }

        await deletePendingAction(action.id);
        successCount++;
      } catch (error) {
        console.error("Sync failed for action:", action.id, error);
        failCount++;
      }
    }

    setIsSyncing(false);
    syncLock.current = false;
    toast.dismiss(toastId);

    if (successCount > 0) {
      toast.success(`تمت مزامنة ${successCount} عمليات بنجاح`);

      // إشعار شريط النظام (Tray Notification)
      await showTrayNotification({
        title: "تمت المزامنة بنجاح ✅",
        body: `تم رفع ${successCount} من العمليات التي سجلتها أثناء انقطاع الإنترنت.`,
        tag: "offline-sync-success",
        openUrl: "/mandoub"
      });

      router.refresh();
    }

    if (failCount > 0) {
      toast.error(`فشلت مزامنة ${failCount} عمليات. سيتم المحاولة لاحقاً.`);
    }
  };

  useEffect(() => {
    // محاولة المزامنة عند العودة أونلاين
    window.addEventListener("online", performSync);

    // محاولة المزامنة عند التحميل لأول مرة إذا كنا أونلاين
    performSync();

    return () => {
      window.removeEventListener("online", performSync);
    };
  }, []);

  return null; // مكون خلفية لا يظهر شيئاً في الواجهة
}
