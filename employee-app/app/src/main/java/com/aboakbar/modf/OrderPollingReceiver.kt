package com.aboakbar.modf

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class OrderPollingReceiver : BroadcastReceiver() {

    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token"

    override fun onReceive(context: Context, intent: Intent) {
        // تشغيل أو استدعاء الخدمة الأمامية عند إقلاع الهاتف، تحديث الحزمة، أو استقبال إشارة المنبه الدقيق
        val action = intent.action
        if (action == Intent.ACTION_BOOT_COMPLETED || 
            action == "android.intent.action.QUICKBOOT_POWERON" || 
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == "com.aboakbar.modf.ACTION_CHECK_ORDERS") {
            
            val sharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val token = sharedPreferences.getString(KEY_TOKEN, null)
            
            if (!token.isNullOrEmpty()) {
                // تم إيقاف بدء تشغيل الخدمة الخلفية لتقليل استهلاك زيارات Vercel والاعتماد فقط على OneSignal
                /*
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
                */
            }
        }
    }
}
