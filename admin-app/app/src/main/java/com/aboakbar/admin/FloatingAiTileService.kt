package com.aboakbar.admin

import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

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
        val intent = Intent(this, FloatingAiChatActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startActivityAndCollapse(intent)
            } else {
                @Suppress("DEPRECATION")
                startActivityAndCollapse(intent)
            }
        } catch (e: Exception) {
            try {
                startActivity(intent)
            } catch (ex: Exception) {}
        }
    }
}
