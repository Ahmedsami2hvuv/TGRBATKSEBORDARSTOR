package com.aboakbar.modf

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast

class SaveContactAlertActivity : Activity() {

    private var phone: String = ""
    private var contactName: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestWindowFeature(Window.FEATURE_NO_TITLE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }

        setContentView(R.layout.activity_save_contact_alert)
        setFinishOnTouchOutside(false)

        val displayMetrics = resources.displayMetrics
        val width = (displayMetrics.widthPixels * 0.95).toInt()
        window.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT)

        phone = intent.getStringExtra("phone") ?: ""
        contactName = intent.getStringExtra("contactName") ?: ""

        val cleanLocalPhone = formatToLocalDialPhone(phone)

        findViewById<TextView>(R.id.tvSaveContactPhone).text = "📞 $cleanLocalPhone"
        if (contactName.isNotEmpty() && contactName != phone) {
            findViewById<TextView>(R.id.tvSaveContactName).text = "الاسم/المدخل: $contactName"
            findViewById<TextView>(R.id.tvSaveContactName).visibility = android.view.View.VISIBLE
        } else {
            findViewById<TextView>(R.id.tvSaveContactName).visibility = android.view.View.GONE
        }

        findViewById<Button>(R.id.btnOpenDialerToSave).setOnClickListener {
            openDialer(cleanLocalPhone)
            finish()
        }

        findViewById<Button>(R.id.btnCloseSaveDialog).setOnClickListener {
            finish()
        }
    }

    private fun formatToLocalDialPhone(raw: String): String {
        var clean = raw.replace("[^0-9]".toRegex(), "")
        while (clean.startsWith("00")) clean = clean.substring(2)
        if (clean.startsWith("964")) clean = "0" + clean.substring(3)
        if (clean.startsWith("7") && clean.length == 10) clean = "0$clean"
        return clean
    }

    private fun openDialer(targetPhone: String) {
        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$targetPhone")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "تعذر فتح تطبيق الاتصال", Toast.LENGTH_SHORT).show()
        }
    }
}
