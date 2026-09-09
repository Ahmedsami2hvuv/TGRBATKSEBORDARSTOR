package com.aboakbar.modf

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

class OutreachAlarmReceiver : BroadcastReceiver() {

    @SuppressLint("WakelockTimeout")
    override fun onReceive(context: Context, intent: Intent) {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "AboAkbar:OutreachAlarmWakeLock"
        )

        try {
            wakeLock?.acquire(15 * 1000L) // البقاء مستيقظاً لمدة 15 ثانية كافية لتنفيذ الطلب
        } catch (e: Exception) {
            e.printStackTrace()
        }

        if (OutreachSchedulerService.isEnabled(context)) {
            OutreachSchedulerService.fetchAndTriggerOutreachAlert(context, isManual = false)

            val interval = OutreachSchedulerService.getIntervalMinutes(context)
            OutreachSchedulerService.scheduleNextOutreach(context, interval)
        }
    }
}
