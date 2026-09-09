package com.aboakbar.mjhz

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class FloatingAssistantActivity : AppCompatActivity() {

    private val REQUEST_OVERLAY_PERMISSION = 1234

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        checkAndStartAssistant()
    }

    private fun checkAndStartAssistant() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (Settings.canDrawOverlays(this)) {
                startFloatingService()
            } else {
                showPermissionDialog()
            }
        } else {
            startFloatingService()
        }
    }

    private fun showPermissionDialog() {
        AlertDialog.Builder(this)
            .setTitle("🪄 تفعيل مساعد المجهز العائم")
            .setMessage("ليتمكن المساعد من الظهور كقائمة عائمة فوق واتساب وباقي التطبيقات لمساعدتك في التسعير السريع، يرجى تفعيل إذن (الظهور فوق التطبيقات الأخرى).")
            .setPositiveButton("تفعيل الإذن") { _, _ ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    startActivityForResult(intent, REQUEST_OVERLAY_PERMISSION)
                }
            }
            .setNegativeButton("إلغاء") { _, _ ->
                Toast.makeText(this, "لم يتم تفعيل المساعد العائم", Toast.LENGTH_SHORT).show()
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun startFloatingService() {
        val serviceIntent = Intent(this, FloatingAssistantService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(this, serviceIntent)
        } else {
            startService(serviceIntent)
        }
        Toast.makeText(this, "🪄 تم تشغيل المساعد العائم", Toast.LENGTH_SHORT).show()
        finish()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_OVERLAY_PERMISSION) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Settings.canDrawOverlays(this)) {
                    startFloatingService()
                } else {
                    Toast.makeText(this, "يجب منح الإذن لتشغيل المساعد العائم", Toast.LENGTH_LONG).show()
                    finish()
                }
            }
        }
    }
}
