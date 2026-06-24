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

class DoubleOrderActivity : AppCompatActivity() {

    private lateinit var tvSelectedText: TextView
    private lateinit var etSellerPhone: EditText
    private lateinit var etBuyerPhone: EditText
    private lateinit var actvSellerRegion: AutoCompleteTextView
    private lateinit var actvBuyerRegion: AutoCompleteTextView
    private lateinit var spinnerOrderType: Spinner
    private lateinit var etSellerAmount: EditText
    private lateinit var etProfit: EditText
    private lateinit var etDeliveryPrice: EditText
    private lateinit var etOrderTime: EditText
    private lateinit var etOrderNote: EditText
    private lateinit var progressBar: ProgressBar
    private lateinit var btnCancel: Button
    private lateinit var btnSubmit: Button

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val BACKEND_URL = "https://aboakbr.com"

    private var selectedText: String = ""
    private var regionsList: List<Region> = emptyList()
    private var selectedSellerRegionId: String? = null
    private var selectedBuyerRegionId: String? = null

    data class Region(val id: String, val name: String) {
        override fun toString(): String = name
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_double_order)

        tvSelectedText = findViewById(R.id.tvSelectedText)
        etSellerPhone = findViewById(R.id.etSellerPhone)
        etBuyerPhone = findViewById(R.id.etBuyerPhone)
        actvSellerRegion = findViewById(R.id.actvSellerRegion)
        actvBuyerRegion = findViewById(R.id.actvBuyerRegion)
        spinnerOrderType = findViewById(R.id.spinnerOrderType)
        etSellerAmount = findViewById(R.id.etSellerAmount)
        etProfit = findViewById(R.id.etProfit)
        etDeliveryPrice = findViewById(R.id.etDeliveryPrice)
        etOrderTime = findViewById(R.id.etOrderTime)
        etOrderNote = findViewById(R.id.etOrderNote)
        progressBar = findViewById(R.id.progressBar)
        btnCancel = findViewById(R.id.btnCancel)
        btnSubmit = findViewById(R.id.btnSubmit)

        // إعداد Spinner لنوع الطلب
        val types = arrayOf("توصيل فقط", "تجهيز وتسوق", "توصيل مع استرجاع")
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, types)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinnerOrderType.adapter = adapter

        // استقبال النص
        if (intent?.action == Intent.ACTION_PROCESS_TEXT) {
            val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            if (!text.isNullOrEmpty()) {
                selectedText = text
                tvSelectedText.text = selectedText
                analyzeAndAutoFill(selectedText)
            }
        }

        btnCancel.setOnClickListener { finish() }
        btnSubmit.setOnClickListener { submitDoubleOrder() }

        fetchRegions()
    }

    // محاولة استخراج الأرقام تلقائياً من النص لملء الحقول
    private fun analyzeAndAutoFill(text: String) {
        try {
            // استخراج أرقام الهواتف العراقية
            val phonePattern = Pattern.compile("(07[3-9]\\d{8})|(7[3-9]\\d{8})")
            val matcher = phonePattern.matcher(text)
            val phones = mutableListOf<String>()
            while (matcher.find()) {
                phones.add(matcher.group())
            }

            if (phones.isNotEmpty()) {
                etSellerPhone.setText(phones[0])
                if (phones.size > 1) {
                    etBuyerPhone.setText(phones[1])
                }
            }

            // اقتراح القيم الافتراضية للأسعار ووقت الطلب
            etOrderTime.setText("عاجل اليوم")
            etDeliveryPrice.setText("5000") // توصيل افتراضي
            etProfit.setText("0")
            etSellerAmount.setText("0")
        } catch (e: Exception) {
            // تجاهل أي فشل في الاستخراج التلقائي
        }
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
                    Toast.makeText(this@DoubleOrderActivity, "فشل جلب المناطق: ${e.message}", Toast.LENGTH_SHORT).show()
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
                            Toast.makeText(this@DoubleOrderActivity, "خطأ في معالجة المناطق", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@DoubleOrderActivity, "فشل مصادقة حساب الموظف", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun setupRegionsAutoComplete() {
        val adapter = ArrayAdapter(this, android.R.layout.simple_dropdown_item_1line, regionsList)
        
        actvSellerRegion.setAdapter(adapter)
        actvSellerRegion.setOnItemClickListener { parent, _, position, _ ->
            val selected = parent.getItemAtPosition(position) as Region
            selectedSellerRegionId = selected.id
        }

        actvBuyerRegion.setAdapter(adapter)
        actvBuyerRegion.setOnItemClickListener { parent, _, position, _ ->
            val selected = parent.getItemAtPosition(position) as Region
            selectedBuyerRegionId = selected.id
        }
    }

    private fun submitDoubleOrder() {
        val sellerPhone = etSellerPhone.text.toString().trim()
        val buyerPhone = etBuyerPhone.text.toString().trim()
        val orderTime = etOrderTime.text.toString().trim()
        val orderType = spinnerOrderType.selectedItem.toString()
        val sellerAmount = etSellerAmount.text.toString().trim()
        val profit = etProfit.text.toString().trim()
        val deliveryPrice = etDeliveryPrice.text.toString().trim()
        val orderNoteText = etOrderNote.text.toString().trim()

        // التحقق من المدخلات
        if (sellerPhone.isEmpty() || buyerPhone.isEmpty() || orderTime.isEmpty()) {
            Toast.makeText(this, "يرجى ملء الأرقام ووقت الطلب", Toast.LENGTH_SHORT).show()
            return
        }

        // مطابقة المناطق المدخلة للتأكد من اختيارها
        val sellerRegionText = actvSellerRegion.text.toString().trim()
        val matchedSeller = regionsList.find { it.name.equals(sellerRegionText, ignoreCase = true) }
        if (matchedSeller != null) {
            selectedSellerRegionId = matchedSeller.id
        }

        val buyerRegionText = actvBuyerRegion.text.toString().trim()
        val matchedBuyer = regionsList.find { it.name.equals(buyerRegionText, ignoreCase = true) }
        if (matchedBuyer != null) {
            selectedBuyerRegionId = matchedBuyer.id
        }

        if (selectedSellerRegionId == null || selectedBuyerRegionId == null) {
            Toast.makeText(this, "يرجى اختيار مناطق البائع والمشتري بشكل صحيح من القائمة", Toast.LENGTH_SHORT).show()
            return
        }

        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val se = sharedPreferences.getString("se", null)
        val exp = sharedPreferences.getString("exp", null)
        val sig = sharedPreferences.getString("sig", null)

        if (se.isNullOrEmpty() || exp.isNullOrEmpty() || sig.isNullOrEmpty()) {
            Toast.makeText(this, "يرجى تسجيل الدخول إلى بوابتك أولاً في التطبيق الرئيسي", Toast.LENGTH_LONG).show()
            return
        }

        showLoading(true)

        val json = JSONObject().apply {
            put("sellerPhone", sellerPhone)
            put("sellerRegionId", selectedSellerRegionId)
            put("buyerPhone", buyerPhone)
            put("buyerRegionId", selectedBuyerRegionId)
            put("orderTime", orderTime)
            put("orderType", orderType)
            put("sellerAmount", if (sellerAmount.isEmpty()) "0" else sellerAmount)
            put("profit", if (profit.isEmpty()) "0" else profit)
            put("deliveryPrice", if (deliveryPrice.isEmpty()) "0" else deliveryPrice)
            put("orderNoteText", orderNoteText)
        }

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url("$BACKEND_URL/api/employee/two-way-order")
            .header("x-employee-se", se)
            .header("x-employee-exp", exp)
            .header("x-employee-sig", sig)
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    showLoading(false)
                    Toast.makeText(this@DoubleOrderActivity, "فشل في الاتصال: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                runOnUiThread {
                    showLoading(false)
                    if (response.isSuccessful) {
                        try {
                            val jsonRes = JSONObject(responseBody)
                            if (jsonRes.getBoolean("success")) {
                                val orderNumber = jsonRes.getInt("orderNumber")
                                Toast.makeText(this@DoubleOrderActivity, "تم إضافة الطلب ذو الوجهتين بنجاح! رقم الطلب: #$orderNumber", Toast.LENGTH_LONG).show()
                                finish()
                            } else {
                                val err = jsonRes.optString("error", "فشل الإرسال")
                                Toast.makeText(this@DoubleOrderActivity, err, Toast.LENGTH_SHORT).show()
                            }
                        } catch (e: Exception) {
                            Toast.makeText(this@DoubleOrderActivity, "خطأ في معالجة الرد", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        try {
                            val jsonRes = JSONObject(responseBody)
                            val err = jsonRes.optString("error", "فشل إرسال الطلب")
                            Toast.makeText(this@DoubleOrderActivity, err, Toast.LENGTH_SHORT).show()
                        } catch (e: Exception) {
                            Toast.makeText(this@DoubleOrderActivity, "حدث خطأ في السيرفر", Toast.LENGTH_SHORT).show()
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
        etSellerPhone.isEnabled = !show
        etBuyerPhone.isEnabled = !show
        actvSellerRegion.isEnabled = !show
        actvBuyerRegion.isEnabled = !show
        etSellerAmount.isEnabled = !show
        etProfit.isEnabled = !show
        etDeliveryPrice.isEnabled = !show
        etOrderTime.isEnabled = !show
        etOrderNote.isEnabled = !show
    }
}
