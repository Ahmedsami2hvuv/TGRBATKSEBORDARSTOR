const fs = require('fs');
let code = fs.readFileSync('admin-app/app/src/main/java/com/aboakbar/admin/MyNotificationServiceExtension.kt', 'utf8');

const storeOrderBlockStart = '            } else if (type == "store_order") {\n                try {';
const storeOrderBlockEnd = '            } else if (type == "preparer_withdrawal") {';

const newStoreOrderBlock = \            } else if (type == "store_order") {
                try {
                    val orderNumber = additionalData.optInt("orderNumber", 0)
                    if (orderNumber > 0) {
                        event.preventDefault()
                    }
                    val shopName = additionalData.optString("shopName", "")
                    val regionName = additionalData.optString("regionName", "")
                    val orderTime = additionalData.optString("orderTime", "")
                    val orderType = additionalData.optString("orderType", "")
                    val subtotal = additionalData.optDouble("subtotal", 0.0)

                    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                    val channelId = "aboakbar_admin_store_alerts"

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val channelName = "طلبات المتجر"
                        val channel = android.app.NotificationChannel(
                            channelId,
                            channelName,
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        )
                        channel.description = "تنبيهات طلبات متجر خصيب ستور"
                        channel.enableVibration(true)
                        channel.vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)
                        notificationManager.createNotificationChannel(channel)
                    }

                    val openIntent = Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                        putExtra("target_url", "https://aboakbr.com/abo1stor3hlaa2kbr8-47/orders/pending?tab=preparing")
                    }
                    val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                    } else {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val pendingIntent = android.app.PendingIntent.getActivity(context, orderNumber, openIntent, pendingIntentFlags)

                    val alertIntent = Intent(context, OrderAlertActivity::class.java).apply {
                        putExtra("type", "store_order")
                        putExtra("shopName", shopName)
                        putExtra("regionName", regionName)
                        putExtra("orderTime", orderTime)
                        putExtra("orderType", orderType)
                        putExtra("subtotal", subtotal)
                        putExtra("pendingCount", additionalData.optInt("pendingCount", 1))
                        putExtra("orderNumber", orderNumber)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    val alertFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
                    } else {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val alertPendingIntent = android.app.PendingIntent.getActivity(context, orderNumber, alertIntent, alertFlags)

                    val title = "🛍️ طلب من المتجر: regionName"
                    val body = "🕒 orderTime | 📦 عدد المنتجات: " + additionalData.optInt("pendingCount", 1)

                    val largeIcon = android.graphics.BitmapFactory.decodeResource(context.resources, R.drawable.ic_notification_logo)

                    val builder = androidx.core.app.NotificationCompat.Builder(context, channelId)
                        .setSmallIcon(R.drawable.ic_stat_onesignal_default)
                        .setLargeIcon(largeIcon)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setPriority(androidx.core.app.NotificationCompat.PRIORITY_MAX)
                        .setCategory(androidx.core.app.NotificationCompat.CATEGORY_CALL)
                        .setDefaults(androidx.core.app.NotificationCompat.DEFAULT_ALL)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent)
                        .setFullScreenIntent(alertPendingIntent, true)

                    val pattern = longArrayOf(0, 400, 200, 400, 200, 400)
                    builder.setVibrate(pattern)

                    notificationManager.notify(orderNumber, builder.build())
                    
                    if (android.provider.Settings.canDrawOverlays(context)) {
                        context.startActivity(alertIntent)
                    }
                } catch (e: Exception) {
                    // صمت
                }
\

const startIdx = code.indexOf(storeOrderBlockStart);
const endIdx = code.indexOf(storeOrderBlockEnd);
if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + newStoreOrderBlock + code.substring(endIdx);
  fs.writeFileSync('admin-app/app/src/main/java/com/aboakbar/admin/MyNotificationServiceExtension.kt', code);
  console.log('Success');
} else {
  console.log('Not found: ' + startIdx + ' ' + endIdx);
}
