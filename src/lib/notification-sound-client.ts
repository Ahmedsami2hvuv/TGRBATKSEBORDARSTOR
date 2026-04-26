"use client";

import {
  type NotificationSoundPresetId,
  normalizeNotificationSoundPreset,
} from "@/lib/notification-sound-presets";

let sharedCtx: AudioContext | null = null;

function getAudioContextCtor(): (typeof AudioContext) | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/** سياق صوت واحد يُستأنف بعد تفاعل المستخدم (مهم للجوال) */
export function ensureNotificationAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  durationMs: number,
  gainValue: number,
  startAt: number,
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.value = gainValue;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const t0 = ctx.currentTime + startAt;
  oscillator.start(t0);
  oscillator.stop(t0 + durationMs / 1000);
}

/**
 * تشغيل نغمة الإشعار حسب الإعداد (Web Audio).
 * يُفضّل استدعاء `ensureNotificationAudioContext` و`resume` بعد إيماءة المستخدم.
 */
export function playNotificationSound(presetRaw: string): void {
  const preset = normalizeNotificationSoundPreset(presetRaw);
  const ctx = ensureNotificationAudioContext();
  if (!ctx) return;

  void ctx.resume().then(() => {
    try {
      switch (preset) {
        case "beep":
          playTone(ctx, 880, 180, 0.08, 0);
          break;
        case "chime":
          playTone(ctx, 523, 140, 0.07, 0);
          playTone(ctx, 659, 160, 0.07, 0.16);
          break;
        case "bell":
          playTone(ctx, 784, 320, 0.09, 0);
          playTone(ctx, 1046, 420, 0.06, 0.28);
          break;
        case "soft":
          playTone(ctx, 440, 120, 0.035, 0);
          break;
        case "urgent":
          playTone(ctx, 880, 300, 0.12, 0);
          playTone(ctx, 880, 300, 0.12, 0.35);
          playTone(ctx, 880, 600, 0.12, 0.7);
          break;
        default:
          playTone(ctx, 880, 180, 0.08, 0);
      }
    } catch {
      /* سياسات الصوت على الجوال */
    }
  });
}

export type { NotificationSoundPresetId };
