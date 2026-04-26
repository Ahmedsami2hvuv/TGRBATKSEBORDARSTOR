"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import { deleteOrderVoiceNote } from "./voice-note-actions";

export function DeleteVoiceNoteButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={ad.dangerLink}
      onClick={() => {
        if (!window.confirm("حذف الملاحظة الصوتية من هذا الطلب؟")) return;
        start(async () => {
          const r = await deleteOrderVoiceNote(orderId);
          if (r.error) {
            window.alert(r.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "جارٍ الحذف…" : "حذف التسجيل الصوتي"}
    </button>
  );
}
