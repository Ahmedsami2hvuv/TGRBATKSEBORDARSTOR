package com.aboakbar.modf

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

class OutreachAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return

        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == "android.intent.action.QUICKBOOT_POWERON") {
            if (OutreachSchedulerService.isEnabled(context)) {
                OutreachSchedulerService.scheduleNextOutreach(
                    context,
                    OutreachSchedulerService.getIntervalMinutes(context)
                )
            }
            return
        }

        if (action == "com.aboakbar.modf.ACTION_TRIGGER_OUTREACH") {
            if (OutreachSchedulerService.isEnabled(context)) {
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                val wakeLock = powerManager?.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "AboAkbar::OutreachAlarmWakeLock"
                )
                wakeLock?.acquire(15000L)

                // إعادة جدولة التنبيه القادم فوراً
                val interval = OutreachSchedulerService.getIntervalMinutes(context)
                OutreachSchedulerService.scheduleNextOutreach(context, interval)

                // جلب الزبون التالي وإظهار التنبيه
                OutreachSchedulerService.fetchAndTriggerOutreachAlert(context, isManual = false)
            }
        }
    }
}

