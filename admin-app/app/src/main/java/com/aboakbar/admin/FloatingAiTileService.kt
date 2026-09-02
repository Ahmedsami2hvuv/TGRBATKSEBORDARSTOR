package com.aboakbar.admin

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.widget.Toast

class FloatingAiTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        try {
            qsTile?.state = Tile.STATE_INACTIVE
            qsTile?.updateTile()
        } catch (e: Exception) {}
    }

    override fun onClick() {
        super.onClick()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "يرجى منح إذن الظهور فوق التطبيقات أولاً لتشغيل الزر العائم", Toast.LENGTH_LONG).show()
            val permissionIntent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startActivityAndCollapse(permissionIntent)
                } else {
                    @Suppress("DEPRECATION")
                    startActivityAndCollapse(permissionIntent)
                }
            } catch (e: Exception) {
                startActivity(permissionIntent)
            }
            return
        }

        // تشغيل الزر العائم فوق التطبيقات
        try {
            val bubbleIntent = Intent(this, FloatingBubbleService::class.java)
            startService(bubbleIntent)
        } catch (e: Exception) {}

        // فتح نافذة الدردشة العائمة فوراً
        val chatIntent = Intent(this, FloatingAiChatActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startActivityAndCollapse(chatIntent)
            } else {
                @Suppress("DEPRECATION")
                startActivityAndCollapse(chatIntent)
            }
        } catch (e: Exception) {
            try {
                startActivity(chatIntent)
            } catch (ex: Exception) {}
        }
    }
}
