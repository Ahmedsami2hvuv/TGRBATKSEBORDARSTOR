package com.aboakbar.modf

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.regex.Pattern

class PreparationOrderActivity : AppCompatActivity() {

    private lateinit var spinnerTarget: Spinner
    private lateinit var etOrderText: EditText
    private lateinit var etCustomerPhone: EditText
    private lateinit var actvRegion: AutoCompleteTextView
    private lateinit var etOrderTime: EditText
    private lateinit var progressBar: ProgressBar
    private lateinit var btnCancel: Button
    private lateinit var btnSubmit: Button

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val BACKEND_URL = "https://aboakbr.com"

    private var targetsList: MutableList<TargetItem> = mutableListOf()
    private var regionsList: MutableList<RegionItem> = mutableListOf()
    private var selectedRegionId: String? = null

    data class TargetItem(val id: String, val name: String, val type: String, val displayLabel: String) {
        override fun toString(): String = displayLabel
    }

    data class RegionItem(val id: String, val name: String) {
        override fun toString(): String = name
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_preparation_order)

        spinnerTarget = findViewById(R.id.spinnerTarget)
        etOrderText = findViewById(R.id.etOrderText)
        etCustomerPhone = findViewById(R.id.etCustomerPhone)
        actvRegion = findViewById(R.id.actvRegion)
        etOrderTime = findViewById(R.id.etOrderTime)
        progressBar = findViewById(R.id.progressBarPrep)
        btnCancel = findViewById(R.id.btnCancelPrep)
        btnSubmit = findViewById(R.id.btnSubmitPrep)

        // استقبال النص إذا تم التمرير من تحديد النص في الهاتف
        if (intent?.action == Intent.ACTION_PROCESS_TEXT) {
            val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            if (!text.isNullOrEmpty()) {
                etOrderText.setText(text)
                extractPhoneFromText(text)
            }
        }

        btnCancel.setOnClickListener { finish() }
        btnSubmit.setOnClickListener { submitPreparationOrder() }

        fetchTargets()
        fetchRegions()
    }

    private fun extractPhoneFromText(text: String) {
        try {
            val phonePattern = Pattern.compile("(07[3-9]\\d{8})|(7[3-9]\\d{8})")
            val matcher = phonePattern.matcher(text)
            if (matcher.find()) {
                etCustomerPhone.setText(matcher.group())
            }
        } catch (e: Exception) {}
    }

    private fun fetchTargets() {
        val request = Request.Builder()
            .url("$BACKEND_URL/api/employee/suppliers-and-preparers")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    Toast.makeText(this@PreparationOrderActivity, "تعذر جلب قائمة المجهزين: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: ""
                runOnUiThread {
                    if (response.isSuccessful) {
                        try {
                            val json = JSONObject(body)
                            val listArray = json.getJSONArray("list")
                            targetsList.clear()
                            
                            // خيار افتراضي: مجهز عام غير محدد
                            targetsList.add(TargetItem("", "مجهز عام (غير محدد)", "preparer", "📦 مجهز عام (غير محدد)"))

                            for (i in 0 until listArray.length()) {
                                val item = listArray.getJSONObject(i)
                                targetsList.add(
                                    TargetItem(
                                        id = item.getString("id"),
                                        name = item.getString("name"),
                                        type = item.getString("type"),
                                        displayLabel = item.getString("displayLabel")
                                    )
                                )
                            }

                            val adapter = ArrayAdapter(this@PreparationOrderActivity, android.R.layout.simple_spinner_item, targetsList)
                            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                            spinnerTarget.adapter = adapter

                        } catch (e: Exception) {
                            Toast.makeText(this@PreparationOrderActivity, "خطأ في معالجة قائمة المجهزين", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        })
    }

    private fun fetchRegions() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val se = prefs.getString("se", "") ?: ""
        val exp = prefs.getString("exp", "") ?: ""
        val sig = prefs.getString("sig", "") ?: ""

        val request = Request.Builder()
            .url("$BACKEND_URL/api/employee/regions")
            .header("x-employee-se", se)
            .header("x-employee-exp", exp)
            .header("x-employee-sig", sig)
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: ""
                runOnUiThread {
                    if (response.isSuccessful) {
                        try {
                            val json = JSONObject(body)
                            val arr = json.getJSONArray("regions")
                            regionsList.clear()
                            for (i in 0 until arr.length()) {
                                val r = arr.getJSONObject(i)
                                regionsList.add(RegionItem(r.getString("id"), r.getString("name")))
                            }
                            val adapter = ArrayAdapter(this@PreparationOrderActivity, android.R.layout.simple_dropdown_item_1line, regionsList)
                            actvRegion.setAdapter(adapter)
                            actvRegion.setOnItemClickListener { parent, _, position, _ ->
                                val selected = parent.getItemAtPosition(position) as RegionItem
                                selectedRegionId = selected.id
                            }
                        } catch (e: Exception) {}
                    }
                }
            }
        })
    }

    private fun submitPreparationOrder() {
        val text = etOrderText.text.toString().trim()
        val phone = etCustomerPhone.text.toString().trim()
        val orderTime = etOrderTime.text.toString().trim()

        if (text.isEmpty()) {
            Toast.makeText(this, "يرجى كتابة نص الطلب أو المواد", Toast.LENGTH_SHORT).show()
            return
        }

        // مطابقة المنطقة إذا تمت كتابتها يدوياً
        val regionText = actvRegion.text.toString().trim()
        if (regionText.isNotEmpty() && selectedRegionId == null) {
            val matched = regionsList.find { it.name.equals(regionText, ignoreCase = true) }
            if (matched != null) {
                selectedRegionId = matched.id
            }
        }

        val selectedTarget = spinnerTarget.selectedItem as? TargetItem
        val targetType = selectedTarget?.type ?: "preparer"
        val targetId = selectedTarget?.id ?: ""
        val targetName = selectedTarget?.name ?: ""

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val se = prefs.getString("se", "") ?: ""
        val exp = prefs.getString("exp", "") ?: ""
        val sig = prefs.getString("sig", "") ?: ""

        if (se.isEmpty() || exp.isEmpty() || sig.isEmpty()) {
            Toast.makeText(this, "يرجى تسجيل الدخول إلى بوابتك أولاً في التطبيق الرئيسي", Toast.LENGTH_LONG).show()
            return
        }

        showLoading(true)

        val json = JSONObject().apply {
            put("text", text)
            put("phone", phone)
            put("regionId", selectedRegionId)
            put("orderTime", if (orderTime.isEmpty()) "عاجل اليوم" else orderTime)
            put("targetType", targetType)
            put("targetId", targetId)
            put("targetName", targetName)
        }

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url("$BACKEND_URL/api/employee/preparation-order")
            .header("x-employee-se", se)
            .header("x-employee-exp", exp)
            .header("x-employee-sig", sig)
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    showLoading(false)
                    Toast.makeText(this@PreparationOrderActivity, "فشل الاتصال: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                runOnUiThread {
                    showLoading(false)
                    if (response.isSuccessful) {
                        try {
                            val res = JSONObject(responseBody)
                            if (res.getBoolean("success")) {
                                val msg = res.optString("message", "تم إرسال طلب التجهيز بنجاح!")
                                Toast.makeText(this@PreparationOrderActivity, msg, Toast.LENGTH_LONG).show()
                                finish()
                            } else {
                                val err = res.optString("error", "فشل إرسال الطلب")
                                Toast.makeText(this@PreparationOrderActivity, err, Toast.LENGTH_SHORT).show()
                            }
                        } catch (e: Exception) {
                            Toast.makeText(this@PreparationOrderActivity, "خطأ في معالجة استجابة الخادم", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        try {
                            val res = JSONObject(responseBody)
                            Toast.makeText(this@PreparationOrderActivity, res.optString("error", "فشل الإرسال"), Toast.LENGTH_SHORT).show()
                        } catch (e: Exception) {
                            Toast.makeText(this@PreparationOrderActivity, "حدث خطأ في الخادم", Toast.LENGTH_SHORT).show()
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
        etCustomerPhone.isEnabled = !show
        actvRegion.isEnabled = !show
        etOrderTime.isEnabled = !show
        spinnerTarget.isEnabled = !show
    }
}
