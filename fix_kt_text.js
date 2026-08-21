const fs = require('fs');
const path = 'admin-app/app/src/main/java/com/aboakbar/admin/MyNotificationServiceExtension.kt';
let content = fs.readFileSync(path, 'utf8');

content = content.replace('val channelName = "??????? ??????"', 'val channelName = "إشعارات المتجر"');
content = content.replace('description = "??????? ??????? ?? ?????? ??????????"', 'description = "إشعارات الطلبات من المتجر الإلكتروني"');
content = content.replace('val title = "?? ??? ?? ??????: ' + '$' + 'regionName"', 'val title = "🛒 طلب من المتجر: ' + '$' + 'regionName"');
content = content.replace('val body = "? ' + '$' + 'orderTime | ?? ??? ????????: " + additionalData.optInt("pendingCount", 1)', 'val body = "⏰ ' + '$' + 'orderTime | 📦 عدد المنتجات: " + additionalData.optInt("pendingCount", 1)');

content = content.replace('val preparerName = additionalData.optString("preparerName", "â€”")', 'val preparerName = additionalData.optString("preparerName", "—")');
content = content.replace('val time = additionalData.optString("time", "â€”")', 'val time = additionalData.optString("time", "—")');
content = content.replace('val channelName = "ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ØªØ³ÙˆÙŠØ© Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø¬Ù‡Ø²ÙŠÙ†"', 'val channelName = "تنبيهات تسوية حساب المجهزين"');
content = content.replace('description = "Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ØªØ³ÙˆÙŠØ© Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø¬Ù‡Ø²ÙŠÙ†"', 'description = "إشعارات تسوية حساب المجهزين"');
content = content.replace('val title = "ðŸ’µ Ø·Ù„Ø¨ ØªØ³ÙˆÙŠØ© Ø­Ø³Ø§Ø¨ Ù…Ø¬Ù‡Ø²: ' + '$' + 'preparerName"', 'val title = "💵 طلب تسوية حساب مجهز: ' + '$' + 'preparerName"');
content = content.replace('val body = "Ø§Ù„Ù…Ø¨Ù„Øº: ' + '$' + 'amount | Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ: ' + '$' + 'remain"', 'val body = "المبلغ: ' + '$' + 'amount | المتبقي: ' + '$' + 'remain"');

fs.writeFileSync(path, content, 'utf8');
