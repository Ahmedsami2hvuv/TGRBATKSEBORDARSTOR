package com.aboakbar.admin

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class QuickDraftActivity : AppCompatActivity() {

    private lateinit var tvSelectedText: TextView
    private lateinit var spinnerPreparers: Spinner
    private lateinit var btnCancel: Button
    private lateinit var btnSubmit: Button
    private lateinit var progressBar: ProgressBar

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token"
    private val BACKEND_URL = "https://aboakbar.vercel.app"

    private lateinit var tvRegionLabel: TextView
    private lateinit var spinnerRegions: Spinner

    private var selectedText: String = ""
    private var preparerList: List<Preparer> = emptyList()
    private var regionList: List<Region> = emptyList()

    data class Preparer(val id: String, val name: String) {
        override fun toString(): String {
            return name
        }
    }

    data class Region(val id: String, val name: String) {
        override fun toString(): String {
            return name
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Make activity look like a floating dialog
        setContentView(R.layout.activity_quick_draft)

        tvSelectedText = findViewById(R.id.tvSelectedText)
        spinnerPreparers = findViewById(R.id.spinnerPreparers)
        btnCancel = findViewById(R.id.btnCancel)
        btnSubmit = findViewById(R.id.btnSubmit)
        progressBar = findViewById(R.id.progressBar)
        tvRegionLabel = findViewById(R.id.tvRegionLabel)
        spinnerRegions = findViewById(R.id.spinnerRegions)

        if (intent?.action == Intent.ACTION_PROCESS_TEXT) {
            val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            if (!text.isNullOrEmpty()) {
                selectedText = text
                tvSelectedText.text = selectedText
            } else {
                Toast.makeText(this, "لم يتم استلام أي نص", Toast.LENGTH_SHORT).show()
                finish()
                return
            }
        } else {
            finish()
            return
        }

        btnCancel.setOnClickListener {
            finish()
        }

        btnSubmit.setOnClickListener {
            submitDraft()
        }

        fetchPreparers()
    }

    private fun fetchPreparers() {
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = sharedPreferences.getString(KEY_TOKEN, null)

        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "يجب تسجيل الدخول كآدمن أولاً", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        showLoading(true)

        val request = Request.Builder()
            .url("$BACKEND_URL/api/admin/preparers")
            .header("Authorization", "Bearer $token")
            .get()
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
                        try {
                            val jsonRes = JSONObject(responseBody)
                            val preparersArray = jsonRes.getJSONArray("preparers")
                            val list = mutableListOf<Preparer>()
                            for (i in 0 until preparersArray.length()) {
                                val item = preparersArray.getJSONObject(i)
                                list.add(Preparer(item.getString("id"), item.getString("name")))
                            }
                            preparerList = list
                            
                            val adapter = ArrayAdapter(this@QuickDraftActivity, android.R.layout.simple_spinner_item, preparerList)
                            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                            spinnerPreparers.adapter = adapter

                        } catch (e: Exception) {
                            Toast.makeText(this@QuickDraftActivity, "خطأ في قراءة البيانات", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@QuickDraftActivity, "فشل جلب المجهزين (قد تحتاج لتسجيل دخول جديد)", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun submitDraft() {
        if (preparerList.isEmpty()) {
            Toast.makeText(this, "قائمة المجهزين فارغة أو لم يتم تحميلها بعد", Toast.LENGTH_SHORT).show()
            return
        }

        val selectedPreparer = spinnerPreparers.selectedItem as? Preparer
        if (selectedPreparer == null) {
            Toast.makeText(this, "يرجى اختيار مجهز", Toast.LENGTH_SHORT).show()
            return
        }

        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = sharedPreferences.getString(KEY_TOKEN, null)

        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "يجب تسجيل الدخول كآدمن أولاً", Toast.LENGTH_LONG).show()
            return
        }

        showLoading(true)

        val json = JSONObject()
        json.put("text", selectedText)
        json.put("preparerId", selectedPreparer.id)

        if (spinnerRegions.visibility == View.VISIBLE) {
            val selectedRegion = spinnerRegions.selectedItem as? Region
            if (selectedRegion != null) {
                json.put("regionId", selectedRegion.id)
            } else {
                showLoading(false)
                Toast.makeText(this, "يرجى اختيار المنطقة", Toast.LENGTH_SHORT).show()
                return
            }
        }

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url("$BACKEND_URL/api/admin/quick-draft")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    showLoading(false)
                    Toast.makeText(this@QuickDraftActivity, "فشل الإرسال: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                runOnUiThread {
                    showLoading(false)
                    try {
                        val jsonRes = JSONObject(responseBody)
                        if (response.isSuccessful && jsonRes.optBoolean("success")) {
                            Toast.makeText(this@QuickDraftActivity, "تم إضافة مسودة التجهيز بنجاح!", Toast.LENGTH_LONG).show()
                            finish()
                        } else if (response.isSuccessful && jsonRes.optBoolean("requireRegion")) {
                            // Server asking for Region clarification
                            tvRegionLabel.visibility = View.VISIBLE
                            spinnerRegions.visibility = View.VISIBLE
                            
                            val regionsArray = jsonRes.getJSONArray("suggestedRegions")
                            val list = mutableListOf<Region>()
                            for (i in 0 until regionsArray.length()) {
                                val item = regionsArray.getJSONObject(i)
                                list.add(Region(item.getString("id"), item.getString("name")))
                            }
                            regionList = list
                            
                            val adapter = ArrayAdapter(this@QuickDraftActivity, android.R.layout.simple_spinner_item, regionList)
                            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                            spinnerRegions.adapter = adapter
                            
                            Toast.makeText(this@QuickDraftActivity, "يرجى تحديد المنطقة بدقة", Toast.LENGTH_SHORT).show()
                        } else {
                            val errorMsg = jsonRes.optString("error", "فشل الإرسال. تأكد من تسجيل الدخول كآدمن.")
                            Toast.makeText(this@QuickDraftActivity, errorMsg, Toast.LENGTH_SHORT).show()
                        }
                    } catch (e: Exception) {
                        Toast.makeText(this@QuickDraftActivity, "خطأ في استلام الرد: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        btnSubmit.isEnabled = !show
        btnCancel.isEnabled = !show
        spinnerPreparers.isEnabled = !show
        if (spinnerRegions.visibility == View.VISIBLE) {
            spinnerRegions.isEnabled = !show
        }
    }
}
