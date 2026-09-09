package com.aboakbar.modf

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class SaveContactReceiver : BroadcastReceiver() {

    @SuppressLint("WakelockTimeout")
    override fun onReceive(context: Context, intent: Intent) {
        val phone = intent.getStringExtra("phone") ?: ""
        val contactName = intent.getStringExtra("contactName") ?: ""

        if (phone.isEmpty()) return

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "AboAkbar:SaveContactWakeLock"
        )

        try {
            wakeLock?.acquire(10 * 1000L)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        val reqCode = (System.currentTimeMillis() % 1000000).toInt()

        // 1. فتح نافذة الحفظ المنبثقة
        val alertIntent = Intent(context, SaveContactAlertActivity::class.java).apply {
            putExtra("phone", phone)
            putExtra("contactName", contactName)
            data = Uri.parse("custom://save_alert/$phone/$reqCode")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        try {
            context.startActivity(alertIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 2. إصدار إشعار عالي الأولوية بضغطة زر لفتح تطبيق الاتصال مباشرة
        showSaveContactNotification(context, phone, contactName, alertIntent, reqCode)
    }

    private fun showSaveContactNotification(
        context: Context,
        phone: String,
        contactName: String,
        alertIntent: Intent,
        reqCode: Int
    ) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            val channelId = "save_contact_channel"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    channelId,
                    "تذكيرات تخزين أرقام الزبائن",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "إشعارات تذكير الموظف بفتح تطبيق الاتصال لحفظ رقم الزبون"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 200, 150, 200)
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(channel)
            }

            val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val contentPendingIntent = PendingIntent.getActivity(context, reqCode + 1, alertIntent, pendingFlags)

            // زر مباشر لفتح تطبيق الاتصال بالرقم
            var cleanPhone = phone.replace("[^0-9]".toRegex(), "")
            while (cleanPhone.startsWith("00")) cleanPhone = cleanPhone.substring(2)
            if (cleanPhone.startsWith("964")) cleanPhone = "0" + cleanPhone.substring(3)
            if (cleanPhone.startsWith("7") && cleanPhone.length == 10) cleanPhone = "0$cleanPhone"

            val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$cleanPhone")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val dialPendingIntent = PendingIntent.getActivity(context, reqCode + 2, dialIntent, pendingFlags)

            val displayName = if (contactName.isNotEmpty() && contactName != phone) "$contactName ($cleanPhone)" else cleanPhone

            val builder = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("📞 حان موعد تخزين رقم الزبون في الهاتف")
                .setContentText("الرقم: $displayName — اضغط لحفظه في جهات الاتصال")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(contentPendingIntent, true)
                .setContentIntent(contentPendingIntent)
                .setAutoCancel(true)
                .setVibrate(longArrayOf(0, 200, 150, 200))
                .addAction(
                    android.R.drawable.ic_menu_call,
                    "📞 فتح تطبيق الاتصال للحفظ",
                    dialPendingIntent
                )

            notificationManager.notify(reqCode, builder.build())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
