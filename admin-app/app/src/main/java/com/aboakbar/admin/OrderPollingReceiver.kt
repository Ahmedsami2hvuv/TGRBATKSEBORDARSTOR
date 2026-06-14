package com.aboakbar.admin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class OrderPollingReceiver : BroadcastReceiver() {

    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token"

    override fun onReceive(context: Context, intent: Intent) {
        // تشغيل الخدمة الأمامية تلقائياً عند إقلاع الهاتف أو تحديث الحزمة
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || 
            intent.action == "android.intent.action.QUICKBOOT_POWERON" || 
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            
            val sharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val token = sharedPreferences.getString(KEY_TOKEN, null)
            
            if (!token.isNullOrEmpty()) {
                try {
                    val serviceIntent = Intent(context, OrderForegroundService::class.java)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                } catch (e: Exception) {
                    // تجاهل
                }
            }
        }
    }
}
