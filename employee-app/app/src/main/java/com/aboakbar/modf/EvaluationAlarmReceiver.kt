package com.aboakbar.modf

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class EvaluationAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        
        if (action == "android.intent.action.BOOT_COMPLETED" || action == "android.intent.action.MY_PACKAGE_REPLACED") {
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
                // جلب الطلب وإظهار التنبيه العائم للتقييم
                EvaluationSchedulerService.fetchAndTriggerEvaluationAlert(context)
            }
        }
    }
}
