package com.aboakbar.modf

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

class EvaluationAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        
        if (action == "android.intent.action.BOOT_COMPLETED" || 
            action == "android.intent.action.MY_PACKAGE_REPLACED" ||
            action == "android.intent.action.QUICKBOOT_POWERON") {
            // إعادة تفعيل الجدولة عند تشغيل الهاتف
            if (EvaluationSchedulerService.isEnabled(context)) {
                EvaluationSchedulerService.scheduleNextEvaluation(
                    context,
                    EvaluationSchedulerService.getIntervalMinutes(context)
                )
            }
            return
        }

        if (action == "com.aboakbar.modf.ACTION_TRIGGER_EVALUATION") {
            if (EvaluationSchedulerService.isEnabled(context)) {
                // إبقاء المعالج مستيقظاً لمدة 15 ثانية لإتمام جلب البيانات وإطلاق الإشعار
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                val wakeLock = powerManager?.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "AboAkbar::EvaluationAlarmWakeLock"
                )
                wakeLock?.acquire(15000L) // 15 ثانية كحد أقصى

                // إعادة جدولة التنبيه القادم فوراً
                val interval = EvaluationSchedulerService.getIntervalMinutes(context)
                EvaluationSchedulerService.scheduleNextEvaluation(context, interval)

                // جلب الطلب وإظهار التنبيه العائم والإشعار
                EvaluationSchedulerService.fetchAndTriggerEvaluationAlert(context)
            }
        }
    }
}
