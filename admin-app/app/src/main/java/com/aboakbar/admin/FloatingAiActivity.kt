package com.aboakbar.admin

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class FloatingAiActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "يرجى منح إذن الظهور فوق التطبيقات أولاً لتشغيل الزر العائم", Toast.LENGTH_LONG).show()
            val permissionIntent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
            startActivity(permissionIntent)
            finish()
            return
        }

        // تشغيل الزر العائم فوق التطبيقات
        try {
            val bubbleIntent = Intent(this, FloatingBubbleService::class.java)
            startService(bubbleIntent)
        } catch (e: Exception) {}

        // فتح نافذة الدردشة العائمة فوراً
        try {
            val chatIntent = Intent(this, FloatingAiChatActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(chatIntent)
        } catch (e: Exception) {}

        finish()
    }
}
