package com.aboakbar.admin

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class FloatingAiActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            val intent = Intent(this, VoiceAssistantActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
        } catch (e: Exception) {}
        finish()
    }
}
