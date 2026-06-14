package com.aboakbar.admin

import android.content.Context
import android.content.Intent
import androidx.annotation.Keep
import com.onesignal.notifications.INotificationReceivedEvent
import com.onesignal.notifications.INotificationServiceExtension

@Keep
class MyNotificationServiceExtension : INotificationServiceExtension {
    override fun onNotificationReceived(event: INotificationReceivedEvent) {
        val context = event.context
        val notification = event.notification
        val additionalData = notification.additionalData

        // التحقق من أن الإشعار يخص طلب جديد
        if (additionalData != null && additionalData.has("type") && additionalData.getString("type") == "new_order") {
            try {
                val orderNumber = additionalData.optInt("orderNumber", 0)
                val shopName = additionalData.optString("shopName", "—")
                val regionName = additionalData.optString("regionName", "—")
                val orderTime = additionalData.optString("orderTime", "فوري")
                val orderType = additionalData.optString("orderType", "توصيل")
                val subtotal = additionalData.optInt("subtotal", 0)

                // 1. تشغيل الكرة العائمة لإعلام الأدمن واهتزاز الهاتف فوراً
                val bubbleIntent = Intent(context, FloatingBubbleService::class.java).apply {
                    putExtra("pendingCount", 1)
                    putExtra("orderNumber", orderNumber)
                }
                context.startService(bubbleIntent)

                // 2. تشغيل الشاشة المنبثقة الإجبارية فوق كل التطبيقات
                val alertIntent = Intent(context, OrderAlertActivity::class.java).apply {
                    putExtra("shopName", shopName)
                    putExtra("regionName", regionName)
                    putExtra("orderTime", orderTime)
                    putExtra("orderType", orderType)
                    putExtra("subtotal", subtotal)
                    putExtra("pendingCount", 1)
                    putExtra("orderNumber", orderNumber)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                context.startActivity(alertIntent)

            } catch (e: Exception) {
                // تجاهل الأخطاء
            }
        }
    }
}
