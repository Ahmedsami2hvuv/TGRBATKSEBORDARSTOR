package com.aboakbar.modf

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
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

class QuickSellActivity : AppCompatActivity() {

    private lateinit var tvSelectedText: TextView
    private lateinit var spinnerCategories: Spinner
    private lateinit var etNewCategory: EditText
    private lateinit var btnSubmit: Button
    private lateinit var btnCancel: Button
    private lateinit var progressBar: ProgressBar

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token"
    private val BACKEND_URL = "https://aboakbr.com"

    private var selectedText: String = ""
    private var categoryList = mutableListOf<CategoryItem>()

    data class CategoryItem(val id: String, val name: String) {
        override fun toString(): String = name
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_quick_sell)

        tvSelectedText = findViewById(R.id.tvSelectedText)
        spinnerCategories = findViewById(R.id.spinnerCategories)
        etNewCategory = findViewById(R.id.etNewCategory)
        btnSubmit = findViewById(R.id.btnSubmit)
        btnCancel = findViewById(R.id.btnCancel)
        progressBar = findViewById(R.id.progressBar)

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

        btnCancel.setOnClickListener { finish() }

        btnSubmit.setOnClickListener { submitSell() }

        fetchCategories()
    }

    private fun fetchCategories() {
        showLoading(true)
        val request = Request.Builder()
            .url("$BACKEND_URL/api/sell")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    showLoading(false)
                    setupCategorySpinner()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: ""
                runOnUiThread {
                    showLoading(false)
                    try {
                        val json = JSONObject(body)
                        if (json.optBoolean("success")) {
                            val arr = json.getJSONArray("categories")
                            categoryList.clear()
                            categoryList.add(CategoryItem("default", "اختر القسم..."))
                            for (i in 0 until arr.length()) {
                                val item = arr.getJSONObject(i)
                                categoryList.add(CategoryItem(item.getString("id"), item.getString("name")))
                            }
                            categoryList.add(CategoryItem("new", "➕ إضافة قسم جديد..."))
                            setupCategorySpinner()
                        }
                    } catch (e: Exception) {
                        setupCategorySpinner()
                    }
                }
            }
        })
    }

    private fun setupCategorySpinner() {
        if (categoryList.isEmpty()) {
            categoryList.add(CategoryItem("default", "اختر القسم..."))
            categoryList.add(CategoryItem("new", "➕ إضافة قسم جديد..."))
        }

        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, categoryList)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinnerCategories.adapter = adapter

        spinnerCategories.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                val selected = categoryList[position]
                if (selected.id == "new") {
                    etNewCategory.visibility = View.VISIBLE
                } else {
                    etNewCategory.visibility = View.GONE
                }
            }

            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
        }
    }

    private fun submitSell() {
        val selectedPos = spinnerCategories.selectedItemPosition
        val selectedCategory = if (selectedPos in 0 until categoryList.size) categoryList[selectedPos] else null

        var categoryId: String? = null
        var categoryName: String? = null

        if (selectedCategory != null) {
            if (selectedCategory.id == "new") {
                categoryName = etNewCategory.text.toString().trim()
                if (categoryName.isEmpty()) {
                    Toast.makeText(this, "يرجى كتابة اسم القسم الجديد", Toast.LENGTH_SHORT).show()
                    return
                }
            } else if (selectedCategory.id != "default") {
                categoryId = selectedCategory.id
            }
        }

        val token = getSavedPortalUrl()
        showLoading(true)

        val json = JSONObject()
        json.put("text", selectedText)
        if (categoryId != null) json.put("categoryId", categoryId)
        if (categoryName != null) json.put("categoryName", categoryName)
        if (token != null) json.put("staffToken", token)

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url("$BACKEND_URL/api/staff/marketplace/quick-sell")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    showLoading(false)
                    Toast.makeText(this@QuickSellActivity, "فشل الاتصال بالسيرفر", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val resStr = response.body?.string() ?: ""
                runOnUiThread {
                    showLoading(false)
                    try {
                        val resJson = JSONObject(resStr)
                        if (resJson.optBoolean("success")) {
                            Toast.makeText(this@QuickSellActivity, "تم رفع البيعة ونشرها بنجاح! 🎉", Toast.LENGTH_LONG).show()
                            finish()
                        } else {
                            val msg = resJson.optString("error", "فشل النشر")
                            Toast.makeText(this@QuickSellActivity, msg, Toast.LENGTH_SHORT).show()
                        }
                    } catch (e: Exception) {
                        Toast.makeText(this@QuickSellActivity, "خطأ في المعالجة", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        btnSubmit.isEnabled = !show
        btnCancel.isEnabled = !show
    }

    private fun getSavedPortalUrl(): String? {
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return sharedPreferences.getString(KEY_TOKEN, null)
    }
}
