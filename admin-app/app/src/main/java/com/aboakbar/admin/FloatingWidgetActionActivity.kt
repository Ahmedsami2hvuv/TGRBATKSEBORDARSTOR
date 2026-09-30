package com.aboakbar.admin

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class FloatingWidgetActionActivity : AppCompatActivity() {

    private val OVERLAY_PERMISSION_REQ_CODE = 5463

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        handleFloatingWidgetRequest()
    }

    private fun handleFloatingWidgetRequest() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, getString(R.string.floating_widget_permission_required), Toast.LENGTH_LONG).show()
            try {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
                startActivityForResult(intent, OVERLAY_PERMISSION_REQ_CODE)
            } catch (e: Exception) {
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                startActivityForResult(intent, OVERLAY_PERMISSION_REQ_CODE)
            }
        } else {
            toggleOrStartFloatingWidget()
        }
    }

    private fun toggleOrStartFloatingWidget() {
        if (FloatingWidgetService.isRunning) {
            // إذا كان يعمل، نقوم بإيقافه مع إشعار توست
            val intent = Intent(this, FloatingWidgetService::class.java).apply {
                action = FloatingWidgetService.ACTION_HIDE
            }
            startService(intent)
            Toast.makeText(this, getString(R.string.floating_widget_stopped), Toast.LENGTH_SHORT).show()
        } else {
            // تشغيل الزر العائم
            val intent = Intent(this, FloatingWidgetService::class.java).apply {
                action = FloatingWidgetService.ACTION_SHOW
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
            Toast.makeText(this, getString(R.string.floating_widget_started), Toast.LENGTH_SHORT).show()
        }
        finish()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == OVERLAY_PERMISSION_REQ_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
                val intent = Intent(this, FloatingWidgetService::class.java).apply {
                    action = FloatingWidgetService.ACTION_SHOW
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(intent)
                } else {
                    startService(intent)
                }
                Toast.makeText(this, getString(R.string.floating_widget_started), Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "لم يتم منح صلاحية الظهور فوق التطبيقات", Toast.LENGTH_SHORT).show()
            }
            finish()
        }
    }
}
