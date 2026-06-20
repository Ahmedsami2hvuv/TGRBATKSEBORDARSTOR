package com.aboakbar.mjhz

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Window
import android.view.WindowManager
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import android.widget.LinearLayout
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

class OrderAlertActivity : Activity() {

    private var vibrator: Vibrator? = null
    private val client = OkHttpClient()
    private val BASE_URL = "https://aboakbar.vercel.app/api/admin"
    private var adminToken: String? = null
    private var currentOrderNumber: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
        
        setContentView(R.layout.activity_order_alert)
        setFinishOnTouchOutside(false)

        val prefs = getSharedPreferences("AboAkbarPrefs", Context.MODE_PRIVATE)
        adminToken = prefs.getString("admin_token", null)

        val shopName = intent.getStringExtra("shopName") ?: "—"
        val regionName = intent.getStringExtra("regionName") ?: "—"
        val orderTime = intent.getStringExtra("orderTime") ?: "فوري"
        val orderType = intent.getStringExtra("orderType") ?: "—"
        val subtotal = intent.getDoubleExtra("subtotal", 0.0)
        val pendingCount = intent.getIntExtra("pendingCount", 0)
        val productsText = intent.getStringExtra("productsText") ?: ""
        currentOrderNumber = intent.getIntExtra("orderNumber", 0)

        findViewById<TextView>(R.id.tvAlertHeader).text = "🚨 طلب تجهيز جديد"
        findViewById<TextView>(R.id.tvAlertTitle).text = "$shopName — $regionName"
        findViewById<TextView>(R.id.tvOrderNumber).text = "طلب رقم: #$currentOrderNumber"

        val detailsText = java.lang.StringBuilder()
        detailsText.append("⏰ الوقت: $orderTime\n")
        detailsText.append("📦 النوع: $orderType\n")
        if (subtotal > 0) {
            detailsText.append("💵 السعر بدون توصيل: ${formatNumber(subtotal)} د.ع\n")
        }
        if (productsText.isNotEmpty()) {
            detailsText.append("\n📦 المنتجات:\n$productsText\n")
        }
        if (pendingCount > 1) {
            detailsText.append("\n🔔 إجمالي الطلبات المعلقة: $pendingCount")
        }
        findViewById<TextView>(R.id.tvOrderDetails).text = detailsText.toString()

        setupButtons()
        playNotificationEffects()
        fetchCouriers()
    }

    private fun setupButtons() {
        val layoutMainButtons = findViewById<LinearLayout>(R.id.layoutMainButtons)
        val layoutAssign = findViewById<LinearLayout>(R.id.layoutAssign)

        findViewById<Button>(R.id.btnOpenApp).setOnClickListener {
            saveDismissedOrder(currentOrderNumber)
            val mainIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(mainIntent)
            finish()
        }

        findViewById<Button>(R.id.btnCloseAlert).setOnClickListener {
            saveDismissedOrder(currentOrderNumber)
            finish()
        }

        findViewById<Button>(R.id.btnRejectOrder).visibility = View.GONE
        findViewById<Button>(R.id.btnAssignOrder).visibility = View.GONE
        findViewById<Button>(R.id.btnCancelAssign).visibility = View.GONE
        findViewById<Button>(R.id.btnConfirmAssign).visibility = View.GONE
    }

    private fun fetchCouriers() {
        if (adminToken.isNullOrEmpty()) return

        val request = Request.Builder()
            .url("$BASE_URL/couriers")
            .header("Authorization", "Bearer $adminToken")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                e.printStackTrace()
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) return
                val responseData = response.body?.string() ?: return
                
                try {
                    val json = JSONObject(responseData)
                    val array = json.getJSONArray("couriers")
                    runOnUiThread {
                        populateCouriers(array)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        })
    }

    private fun populateCouriers(array: JSONArray) {
        val cgCouriers = findViewById<ChipGroup>(R.id.cgCouriers)
        cgCouriers.removeAllViews()
        cgCouriers.isSingleSelection = true
        cgCouriers.isSelectionRequired = true

        for (i in 0 until array.length()) {
            val item = array.getJSONObject(i)
            val id = item.getString("id")
            val name = item.getString("name")

            val chip = Chip(this)
            chip.text = name
            chip.tag = id
            chip.isCheckable = true
            chip.setOnClickListener {
                sendOrderAction("assign", id)
            }
            cgCouriers.addView(chip)
        }
    }

    private fun sendOrderAction(action: String, courierId: String?) {
        if (adminToken.isNullOrEmpty()) {
            Toast.makeText(this, "عفواً، لا يوجد جلسة تسجيل دخول نشطة", Toast.LENGTH_SHORT).show()
            return
        }

        val json = JSONObject()
        json.put("orderNumber", currentOrderNumber)
        json.put("action", action)
        if (courierId != null) {
            json.put("courierId", courierId)
        }

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url("$BASE_URL/order-action")
            .post(body)
            .header("Authorization", "Bearer $adminToken")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    Toast.makeText(this@OrderAlertActivity, "فشل الاتصال بالخادم", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseData = response.body?.string()
                runOnUiThread {
                    if (response.isSuccessful) {
                        saveDismissedOrder(currentOrderNumber)
                        Toast.makeText(this@OrderAlertActivity, "تم التنفيذ بنجاح", Toast.LENGTH_SHORT).show()
                        finish() // إغلاق التنبيه
                    } else {
                        Toast.makeText(this@OrderAlertActivity, "خطأ: ${response.code}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun playNotificationEffects() {
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            
            val pattern = longArrayOf(0, 500, 200, 500, 200, 500)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(android.os.VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, -1)
            }
        } catch (e: Exception) {
            // تجاهل
        }
    }

    private fun formatNumber(num: Double): String {
        return try {
            if (num % 1.0 == 0.0) {
                String.format("%,d", num.toLong())
            } else {
                String.format("%,.2f", num)
            }
        } catch (e: Exception) {
            num.toString()
        }
    }

    private fun saveDismissedOrder(orderId: Int) {
        if (orderId <= 0) return
        try {
            val prefs = getSharedPreferences("AboAkbarPrefs", Context.MODE_PRIVATE)
            val dismissedSet = prefs.getStringSet("dismissed_order_numbers", HashSet<String>()) ?: HashSet<String>()
            val newSet = HashSet<String>(dismissedSet)
            newSet.add(orderId.toString())
            prefs.edit().putStringSet("dismissed_order_numbers", newSet).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            // تجاهل
        }
        super.onDestroy()
    }
}
