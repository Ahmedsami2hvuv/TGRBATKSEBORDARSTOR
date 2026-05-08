"use client";

import { useEffect, useRef } from "react";
import {
  ensureNotificationAudioContext,
  playNotificationSound,
} from "@/lib/notification-sound-client";

type Auth = { c: string; exp?: string; s: string };

/**
 * يستطلع إسناد طلبات جديدة للمندوب ويشغّل صوتاً عند زيادة عدد الطلبات المسندة.
 */
export function MandoubAssignmentPoller({ auth }: { auth: Auth }) {
  const lastAssignedRef = useRef<number | null>(null);

  useEffect(() => {
    // Background polling disabled by user request to stop background loading
    return () => {};
  }, [auth.c, auth.exp, auth.s]);

  return null;
}
