package com.aboakbar.modf

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class QuickDraftActivity : AppCompatActivity() {

    private lateinit var tvSelectedText: TextView
    private lateinit var etOrderText: EditText
    private lateinit var actvRegion: AutoCompleteTextView
    private lateinit var etOrderTime: EditText
    private lateinit var progressBar: ProgressBar
    private lateinit var btnCancel: Button
    private lateinit var btnSubmit: Button

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val BACKEND_URL = "https://aboakbr.com"

    private var selectedText: String = ""
    private var regionsList: List<Region> = emptyList()
    private var selectedRegionId: String? = null

    data class Region(val id: String, val name: String) {
        override fun toString(): String = name
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // جعل النافذة بكامل عرض وارتفاع الشاشة
        window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)

        setContentView(R.layout.activity_quick_draft)

        tvSelectedText = findViewById(R.id.tvSelectedText)
        etOrderText = findViewById(R.id.etOrderText)
        actvRegion = findViewById(R.id.actvRegion)
        etOrderTime = findViewById(R.id.etOrderTime)
        progressBar = findViewById(R.id.progressBar)
        btnCancel = findViewById(R.id.btnCancel)
        btnSubmit = findViewById(R.id.btnSubmit)

        if (intent?.action == Intent.ACTION_PROCESS_TEXT) {
            val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            if (!text.isNullOrEmpty()) {
                selectedText = text
                tvSelectedText.visibility = View.VISIBLE
                tvSelectedText.text = selectedText
                etOrderText.setText(selectedText)
            }
        }

        btnCancel.setOnClickListener { finish() }
        btnSubmit.setOnClickListener { submitQuickDraft() }

        fetchRegions()
    }

    private fun fetchRegions() {
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val se = sharedPreferences.getString("se", null)
        val exp = sharedPreferences.getString("exp", null)
        val sig = sharedPreferences.getString("sig", null)

        if (se.isNullOrEmpty() || exp.isNullOrEmpty() || sig.isNullOrEmpty()) {
            Toast.makeText(this, "يرجى تسجيل الدخول إلى بوابتك أولاً في التطبيق الرئيسي", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        showLoading(true)

        val request = Request.Builder()
            .url("$BACKEND_URL/api/employee/regions")
            .header("x-employee-se", se)
            .header("x-employee-exp", exp)
            .header("x-employee-sig", sig)
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    showLoading(false)
                    Toast.makeText(this@QuickDraftActivity, "فشل جلب المناطق: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                runOnUiThread {
                    showLoading(false)
                    if (response.isSuccessful) {
                        try {
                            val jsonRes = JSONObject(responseBody)
                            val regionsArray = jsonRes.getJSONArray("regions")
                            val list = mutableListOf<Region>()
                            for (i in 0 until regionsArray.length()) {
                                val item = regionsArray.getJSONObject(i)
                                list.add(Region(item.getString("id"), item.getString("name")))
                            }
                            regionsList = list
                            setupRegionsAutoComplete()
                        } catch (e: Exception) {
                            Toast.makeText(this@QuickDraftActivity, "خطأ في معالجة المناطق", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        })
    }

    private fun setupRegionsAutoComplete() {
        val adapter = ArrayAdapter(this, android.R.layout.simple_dropdown_item_1line, regionsList)
        actvRegion.setAdapter(adapter)
        actvRegion.setOnItemClickListener { parent, _, position, _ ->
            val selected = parent.getItemAtPosition(position) as Region
            selectedRegionId = selected.id
        }
    }

    private fun submitQuickDraft() {
        val text = etOrderText.text.toString().trim()
        val orderTime = etOrderTime.text.toString().trim()

        if (text.isEmpty()) {
            Toast.makeText(this, "يرجى كتابة أو لصق نص الطلب", Toast.LENGTH_SHORT).show()
            return
        }

        val regionText = actvRegion.text.toString().trim()
        if (regionText.isNotEmpty() && selectedRegionId == null) {
            val matched = regionsList.find { it.name.equals(regionText, ignoreCase = true) }
            if (matched != null) {
                selectedRegionId = matched.id
            }
        }

        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val se = sharedPreferences.getString("se", null)
        val exp = sharedPreferences.getString("exp", null)
        val sig = sharedPreferences.getString("sig", null)

        showLoading(true)

        val json = JSONObject().apply {
            put("text", text)
            put("regionId", selectedRegionId)
            put("orderTime", if (orderTime.isEmpty()) "عاجل اليوم" else orderTime)
        }

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url("$BACKEND_URL/api/employee/quick-draft")
            .header("x-employee-se", se ?: "")
            .header("x-employee-exp", exp ?: "")
            .header("x-employee-sig", sig ?: "")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    showLoading(false)
                    Toast.makeText(this@QuickDraftActivity, "فشل الاتصال: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                runOnUiThread {
                    showLoading(false)
                    if (response.isSuccessful) {
                        Toast.makeText(this@QuickDraftActivity, "تم رفع الطلب بنجاح!", Toast.LENGTH_LONG).show()
                        finish()
                    } else {
                        try {
                            val res = JSONObject(responseBody)
                            Toast.makeText(this@QuickDraftActivity, res.optString("error", "فشل الرفع"), Toast.LENGTH_SHORT).show()
                        } catch (e: Exception) {
                            Toast.makeText(this@QuickDraftActivity, "حدث خطأ في الخادم", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        })
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        btnSubmit.isEnabled = !show
        btnCancel.isEnabled = !show
        etOrderText.isEnabled = !show
        actvRegion.isEnabled = !show
        etOrderTime.isEnabled = !show
    }
}
