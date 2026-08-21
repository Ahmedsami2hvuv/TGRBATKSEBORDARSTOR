
const fs = require("fs");
const path = "admin-app/app/src/main/java/com/aboakbar/admin/MyNotificationServiceExtension.kt";
let content = fs.readFileSync(path, "utf8");

const replacement = `} else if (type == "store_order") {
                try {
                    val shopName = additionalData.optString("shopName", "")
                    val regionName = additionalData.optString("regionName", "")
                    val orderTime = additionalData.optString("orderTime", "")
                    val orderType = additionalData.optString("orderType", "")
                    val subtotal = additionalData.optDouble("subtotal", 0.0)
                    val orderNumber = additionalData.optInt("orderNumber", 0)

                    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                    val channelId = "aboakbar_admin_notifications"

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val channelName = "??????? ??????"
                        val channel = android.app.NotificationChannel(
                            channelId,
                            channelName,
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        ).apply {
                            description = "??????? ??????? ?? ?????? ??????????"
                            enableLights(true)
                            enableVibration(true)
                            vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)
                        }
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

                    val title = "?? ??? ?? ??????: $regionName"
                    val body = "? $orderTime | ?? ??? ????????: " + additionalData.optInt("pendingCount", 1)

                    val largeIcon = android.graphics.BitmapFactory.decodeResource(context.resources, R.drawable.ic_notification_logo)

                    val builder = NotificationCompat.Builder(context, channelId)
                        .setSmallIcon(R.drawable.ic_stat_onesignal_default)
                        .setLargeIcon(largeIcon)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_CALL)
                        .setDefaults(NotificationCompat.DEFAULT_ALL)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent)
                        .setFullScreenIntent(alertPendingIntent, true)

                    val pattern = longArrayOf(0, 400, 200, 400, 200, 400)
                    builder.setVibrate(pattern)

                    notificationManager.notify(orderNumber, builder.build())
                    context.startActivity(alertIntent)

                } catch (e: Exception) {
                }
            } else if (type == "preparer_withdrawal") {`;

content = content.replace(/} else if \(type == "preparer_withdrawal"\) {/, replacement);

fs.writeFileSync(path, content, "utf8");

