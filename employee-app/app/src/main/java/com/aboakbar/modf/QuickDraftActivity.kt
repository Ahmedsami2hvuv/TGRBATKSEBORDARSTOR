package com.aboakbar.modf

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

import android.webkit.CookieManager

class QuickDraftActivity : AppCompatActivity() {

    private lateinit var tvSelectedText: TextView
    private lateinit var progressBar: ProgressBar

    // Step 1
    private lateinit var layoutStep1: View
    private lateinit var chipGroupPreparers: com.google.android.material.chip.ChipGroup
    private lateinit var btnCancel1: Button
    private lateinit var btnNext: Button

    // Step 2
    private lateinit var layoutStep2: View
    private lateinit var chipGroupRegions: com.google.android.material.chip.ChipGroup
    private lateinit var autoCompleteRegions: android.widget.AutoCompleteTextView
    private lateinit var btnBack: Button

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val BACKEND_URL = "https://aboakbr.com"

    private var selectedText: String = ""
    private var preparerList: List<Preparer> = emptyList()
    private var allRegionsList: List<Region> = emptyList()
    private var suggestedRegionsList: List<Region> = emptyList()

    data class Preparer(val id: String, val name: String)
    data class Region(val id: String, val name: String) {
        override fun toString(): String = name
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_quick_draft)

        tvSelectedText = findViewById(R.id.tvSelectedText)
        progressBar = findViewById(R.id.progressBar)

        layoutStep1 = findViewById(R.id.layoutStep1)
        chipGroupPreparers = findViewById(R.id.chipGroupPreparers)
        btnCancel1 = findViewById(R.id.btnCancel1)
        btnNext = findViewById(R.id.btnNext)

        layoutStep2 = findViewById(R.id.layoutStep2)
        chipGroupRegions = findViewById(R.id.chipGroupRegions)
        autoCompleteRegions = findViewById(R.id.autoCompleteRegions)
        btnBack = findViewById(R.id.btnBack)

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

        btnCancel1.setOnClickListener { finish() }
        btnBack.setOnClickListener {
            layoutStep2.visibility = View.GONE
            layoutStep1.visibility = View.VISIBLE
        }

        btnNext.setOnClickListener { submitDraft(false) }

        autoCompleteRegions.addTextChangedListener(object: android.text.TextWatcher {
            override fun afterTextChanged(s: android.text.Editable?) {
                populateRegionChips(s?.toString() ?: "")
            }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        fetchPreparers()
    }

    private fun getAuthHeaders(): Map<String, String>? {
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        var se = sharedPreferences.getString("se", null)
        var exp = sharedPreferences.getString("exp", null)
        var sig = sharedPreferences.getString("sig", null)

        if (se.isNullOrEmpty() || exp.isNullOrEmpty() || sig.isNullOrEmpty()) {
            try {
                val cookieManager = CookieManager.getInstance()
                val urls = arrayOf("https://aboakbr.com", "https://d.ksebstor.site", "https://aboakbar.vercel.app")
                for (url in urls) {
                    val cookies = cookieManager.getCookie(url)
                    if (!cookies.isNullOrEmpty()) {
                        val cookieArray = cookies.split(";")
                        for (cookie in cookieArray) {
                            val parts = cookie.trim().split("=")
                            if (parts.size >= 2) {
                                when (parts[0]) {
                                    "employee_se" -> se = parts[1]
                                    "employee_exp" -> exp = parts[1]
                                    "employee_sig" -> sig = parts[1]
                                }
                            }
                        }
                    }
                    if (!se.isNullOrEmpty() && !exp.isNullOrEmpty() && !sig.isNullOrEmpty()) {
                        // حفظ في التفضيلات للمرات القادمة
                        sharedPreferences.edit()
                            .putString("se", se)
                            .putString("exp", exp)
                            .putString("sig", sig)
                            .apply()
                        break
                    }
                }
            } catch (e: Exception) {}
        }

        if (se.isNullOrEmpty() || exp.isNullOrEmpty() || sig.isNullOrEmpty()) return null

        return mapOf("x-employee-se" to se!!, "x-employee-exp" to exp!!, "x-employee-sig" to sig!!)
    }

    private fun fetchPreparers() {
        val headers = getAuthHeaders()

        if (headers == null) {
            Toast.makeText(this, "يرجى تسجيل الدخول إلى بوابتك أولاً في التطبيق الرئيسي", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        showLoading(true)

        val requestBuilder = Request.Builder()
            .url("$BACKEND_URL/api/employee/preparers")
        
        headers.forEach { (key, value) -> requestBuilder.header(key, value) }
        
        val request = requestBuilder.get().build()

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
                            populatePreparerChips()
                        } catch (e: Exception) {
                            Toast.makeText(this@QuickDraftActivity, "خطأ في قراءة المجهزين", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@QuickDraftActivity, "فشل جلب المجهزين (قد تحتاج لتسجيل دخول جديد)", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun populatePreparerChips() {
        chipGroupPreparers.removeAllViews()
        val displayMetrics = resources.displayMetrics
        val horizontalInset = (88 * displayMetrics.density).toInt()
        val chipSpacing = (8 * displayMetrics.density).toInt()
        val availableWidth = displayMetrics.widthPixels - horizontalInset
        val chipWidth = (availableWidth - chipSpacing) / 2

        for (preparer in preparerList) {
            val chip = com.google.android.material.chip.Chip(this)
            chip.text = preparer.name
            chip.tag = preparer.id
            chip.isCheckable = true
            chip.layoutParams = android.view.ViewGroup.LayoutParams(chipWidth, android.view.ViewGroup.LayoutParams.WRAP_CONTENT)
            chip.textAlignment = View.TEXT_ALIGNMENT_CENTER
            chipGroupPreparers.addView(chip)
        }
    }

    private fun submitDraft(isFinalStep: Boolean) {
        val selectedPreparerIds = mutableListOf<String>()
        for (i in 0 until chipGroupPreparers.childCount) {
            val chip = chipGroupPreparers.getChildAt(i) as? com.google.android.material.chip.Chip
            if (chip != null && chip.isChecked) {
                selectedPreparerIds.add(chip.tag.toString())
            }
        }

        val headers = getAuthHeaders()

        if (headers == null) {
            Toast.makeText(this, "يرجى تسجيل الدخول إلى بوابتك أولاً في التطبيق الرئيسي", Toast.LENGTH_LONG).show()
            return
        }

        val json = JSONObject()
        json.put("text", selectedText)
        
        val preparerArray = org.json.JSONArray()
        for (id in selectedPreparerIds) {
            preparerArray.put(id)
        }
        json.put("preparerIds", preparerArray)
        json.put("orderTime", "عاجل اليوم")

        if (isFinalStep) {
            var selectedRegionId: String? = null
            
            for (i in 0 until chipGroupRegions.childCount) {
                val chip = chipGroupRegions.getChildAt(i) as? com.google.android.material.chip.Chip
                if (chip != null && chip.isChecked) {
                    selectedRegionId = chip.tag.toString()
                    break
                }
            }

            if (selectedRegionId == null) {
                val typedName = autoCompleteRegions.text.toString().trim()
                if (typedName.isNotEmpty()) {
                    val matched = allRegionsList.find { it.name == typedName }
                    if (matched != null) {
                        selectedRegionId = matched.id
                    }
                }
            }

            if (selectedRegionId != null) {
                json.put("regionId", selectedRegionId)
            } else {
                Toast.makeText(this, "يرجى تحديد المنطقة", Toast.LENGTH_SHORT).show()
                return
            }
        }

        showLoading(true)

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val requestBuilder = Request.Builder()
            .url("$BACKEND_URL/api/employee/quick-draft")
            .post(body)
        
        headers.forEach { (key, value) -> requestBuilder.header(key, value) }

        val request = requestBuilder.build()

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
                            Toast.makeText(this@QuickDraftActivity, "تم إضافة طلب التجهيز بنجاح!", Toast.LENGTH_LONG).show()
                            finish()
                        } else if (response.isSuccessful && jsonRes.optBoolean("requireRegion")) {
                            layoutStep1.visibility = View.GONE
                            layoutStep2.visibility = View.VISIBLE
                            
                            val suggestedArray = jsonRes.optJSONArray("suggestedRegions")
                            if (suggestedArray != null) {
                                val list = mutableListOf<Region>()
                                for (i in 0 until suggestedArray.length()) {
                                    val item = suggestedArray.getJSONObject(i)
                                    list.add(Region(item.getString("id"), item.getString("name")))
                                }
                                suggestedRegionsList = list
                            }
                            
                            val allArray = jsonRes.optJSONArray("allRegions")
                            if (allArray != null) {
                                val list = mutableListOf<Region>()
                                for (i in 0 until allArray.length()) {
                                    val item = allArray.getJSONObject(i)
                                    list.add(Region(item.getString("id"), item.getString("name")))
                                }
                                allRegionsList = list
                            }

                            runOnUiThread {
                                populateRegionChips(autoCompleteRegions.text.toString())
                            }
                            
                            if (!isFinalStep) {
                                Toast.makeText(this@QuickDraftActivity, "يرجى تحديد المنطقة بدقة لطلب التجهيز", Toast.LENGTH_SHORT).show()
                            }
                        } else {
                            val errorMsg = jsonRes.optString("error", "فشل الإرسال.")
                            Toast.makeText(this@QuickDraftActivity, errorMsg, Toast.LENGTH_SHORT).show()
                        }
                    } catch (e: Exception) {
                        Toast.makeText(this@QuickDraftActivity, "خطأ: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        btnNext.isEnabled = !show
        btnCancel1.isEnabled = !show
        btnBack.isEnabled = !show
        for (i in 0 until chipGroupPreparers.childCount) {
            chipGroupPreparers.getChildAt(i).isEnabled = !show
        }
        for (i in 0 until chipGroupRegions.childCount) {
            chipGroupRegions.getChildAt(i).isEnabled = !show
        }
    }

    private fun populateRegionChips(query: String) {
        chipGroupRegions.removeAllViews()
        val displayMetrics = resources.displayMetrics
        val horizontalInset = (88 * displayMetrics.density).toInt()
        val chipSpacing = (8 * displayMetrics.density).toInt()
        val availableWidth = displayMetrics.widthPixels - horizontalInset
        val chipWidth = (availableWidth - chipSpacing) / 2

        val listToUse = if (query.trim().isEmpty()) {
            suggestedRegionsList
        } else {
            allRegionsList.filter { it.name.contains(query.trim(), ignoreCase = true) }
        }

        for (region in listToUse) {
            val chip = com.google.android.material.chip.Chip(this)
            chip.text = region.name
            chip.tag = region.id
            chip.isCheckable = true
            chip.layoutParams = android.view.ViewGroup.LayoutParams(chipWidth, android.view.ViewGroup.LayoutParams.WRAP_CONTENT)
            chip.textAlignment = View.TEXT_ALIGNMENT_CENTER
            
            chip.setOnCheckedChangeListener { _, isChecked ->
                if (isChecked) {
                    submitDraft(true)
                }
            }
            
            chipGroupRegions.addView(chip)
        }
    }
}
