package com.aboakbar.admin

import android.annotation.SuppressLint
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.webkit.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class FloatingAdminActivity : AppCompatActivity() {

    private lateinit var tabAddOrder: TextView
    private lateinit var tabAiChat: TextView
    private lateinit var btnToggleBubbleOverlay: ImageButton
    private lateinit var btnCloseFloatingDialog: TextView
    private lateinit var dismissFloatingOverlay: View

    // تبويب إضافة طلب
    private lateinit var layoutTabAddOrderContent: ScrollView
    private lateinit var etOrderRawText: EditText
    private lateinit var btnPasteClipboard: Button
    private lateinit var chipGroupFloatingPreparers: ChipGroup
    private lateinit var etCustomerPhone: EditText
    private lateinit var etOrderPrice: EditText
    private lateinit var tvSubmitStatus: TextView
    private lateinit var pbSubmitOrder: ProgressBar
    private lateinit var btnSubmitOrderDirectly: Button

    // تبويب الذكاء الاصطناعي
    private lateinit var layoutTabAiContent: FrameLayout
    private lateinit var floatingAiWebView: WebView
    private lateinit var pbFloatingAi: ProgressBar

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token"
    private val BACKEND_URL = "https://aboakbr.com"
    private val AI_URL = "https://aboakbr.com/admin/ai"

    private var preparersList: List<Preparer> = emptyList()
    private var selectedPreparerId: String? = null

    data class Preparer(val id: String, val name: String)

    companion object {
        const val EXTRA_TAB = "extra_tab"
        const val TAB_ADD_ORDER = "tab_add_order"
        const val TAB_AI = "tab_ai"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_floating_admin)

        initViews()
        setupListeners()
        setupAiWebView()
        fetchPreparers()

        val initialTab = intent?.getStringExtra(EXTRA_TAB) ?: TAB_ADD_ORDER
        if (initialTab == TAB_AI) {
            selectAiTab()
        } else {
            selectAddOrderTab()
        }
    }

    private fun initViews() {
        tabAddOrder = findViewById(R.id.tabAddOrder)
        tabAiChat = findViewById(R.id.tabAiChat)
        btnToggleBubbleOverlay = findViewById(R.id.btnToggleBubbleOverlay)
        btnCloseFloatingDialog = findViewById(R.id.btnCloseFloatingDialog)
        dismissFloatingOverlay = findViewById(R.id.dismissFloatingOverlay)

        layoutTabAddOrderContent = findViewById(R.id.layoutTabAddOrderContent)
        etOrderRawText = findViewById(R.id.etOrderRawText)
        btnPasteClipboard = findViewById(R.id.btnPasteClipboard)
        chipGroupFloatingPreparers = findViewById(R.id.chipGroupFloatingPreparers)
        etCustomerPhone = findViewById(R.id.etCustomerPhone)
        etOrderPrice = findViewById(R.id.etOrderPrice)
        tvSubmitStatus = findViewById(R.id.tvSubmitStatus)
        pbSubmitOrder = findViewById(R.id.pbSubmitOrder)
        btnSubmitOrderDirectly = findViewById(R.id.btnSubmitOrderDirectly)

        layoutTabAiContent = findViewById(R.id.layoutTabAiContent)
        floatingAiWebView = findViewById(R.id.floatingAiWebView)
        pbFloatingAi = findViewById(R.id.pbFloatingAi)
    }

    private fun setupListeners() {
        dismissFloatingOverlay.setOnClickListener { finish() }
        btnCloseFloatingDialog.setOnClickListener { finish() }

        tabAddOrder.setOnClickListener { selectAddOrderTab() }
        tabAiChat.setOnClickListener { selectAiTab() }

        btnPasteClipboard.setOnClickListener {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = clipboard.primaryClip
            if (clip != null && clip.itemCount > 0) {
                val text = clip.getItemAt(0).text?.toString() ?: ""
                if (text.isNotEmpty()) {
                    etOrderRawText.setText(text)
                    Toast.makeText(this, "تم لصق النص من الحافظة", Toast.LENGTH_SHORT).show()
                }
            } else {
                Toast.makeText(this, "الحافظة فارغة", Toast.LENGTH_SHORT).show()
            }
        }

        btnSubmitOrderDirectly.setOnClickListener {
            submitOrder()
        }

        btnToggleBubbleOverlay.setOnClickListener {
            toggleFloatingBubbleService()
        }
    }

    private fun selectAddOrderTab() {
        tabAddOrder.setTextColor(Color.WHITE)
        tabAddOrder.setBackgroundResource(R.drawable.bg_floating_item)
        tabAiChat.setTextColor(Color.parseColor("#94A3B8"))
        tabAiChat.setBackgroundResource(0)

        layoutTabAddOrderContent.visibility = View.VISIBLE
        layoutTabAiContent.visibility = View.GONE
    }

    private fun selectAiTab() {
        tabAiChat.setTextColor(Color.WHITE)
        tabAiChat.setBackgroundResource(R.drawable.bg_floating_item)
        tabAddOrder.setTextColor(Color.parseColor("#94A3B8"))
        tabAddOrder.setBackgroundResource(0)

        layoutTabAddOrderContent.visibility = View.GONE
        layoutTabAiContent.visibility = View.VISIBLE

        loadAiPageIfNeeded()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupAiWebView() {
        val settings = floatingAiWebView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(floatingAiWebView, true)
        }

        floatingAiWebView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread {
                    try {
                        request?.grant(request?.resources ?: arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }

        floatingAiWebView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pbFloatingAi.visibility = View.GONE
            }
        }
    }

    private var isAiLoaded = false
    private fun loadAiPageIfNeeded() {
        if (!isAiLoaded) {
            isAiLoaded = true
            val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val savedToken = sharedPreferences.getString(KEY_TOKEN, null)
            if (!savedToken.isNullOrEmpty()) {
                val cookieManager = CookieManager.getInstance()
                cookieManager.setAcceptCookie(true)
                cookieManager.setAcceptThirdPartyCookies(floatingAiWebView, true)
                val cookieString = "admin_token=$savedToken; Domain=aboakbr.com; Path=/; Secure; SameSite=Lax"
                cookieManager.setCookie(BACKEND_URL, cookieString)
                cookieManager.flush()
            }
            floatingAiWebView.loadUrl(AI_URL)
        }
    }

    private fun getAdminToken(): String? {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_TOKEN, null)
    }

    private fun fetchPreparers() {
        val token = getAdminToken() ?: return
        val request = Request.Builder()
            .url("$BACKEND_URL/api/admin/preparers")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    try {
                        val json = JSONObject(body)
                        val arr = json.getJSONArray("preparers")
                        val list = mutableListOf<Preparer>()
                        for (i in 0 until arr.length()) {
                            val item = arr.getJSONObject(i)
                            list.add(Preparer(item.getString("id"), item.getString("name")))
                        }
                        preparersList = list
                        runOnUiThread { populatePreparerChips() }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        })
    }

    private fun populatePreparerChips() {
        chipGroupFloatingPreparers.removeAllViews()
        for (prep in preparersList) {
            val chip = Chip(this)
            chip.text = prep.name
            chip.tag = prep.id
            chip.isCheckable = true
            chip.setOnClickListener {
                selectedPreparerId = prep.id
            }
            chipGroupFloatingPreparers.addView(chip)
        }
        if (preparersList.isNotEmpty() && selectedPreparerId == null) {
            val first = chipGroupFloatingPreparers.getChildAt(0) as? Chip
            first?.isChecked = true
            selectedPreparerId = preparersList[0].id
        }
    }

    private fun submitOrder() {
        val rawText = etOrderRawText.text.toString().trim()
        val phone = etCustomerPhone.text.toString().trim()
        val price = etOrderPrice.text.toString().trim()

        if (rawText.isEmpty() && phone.isEmpty()) {
            Toast.makeText(this, "يرجى كتابة أو لصق تفاصيل الطلب", Toast.LENGTH_SHORT).show()
            return
        }

        val token = getAdminToken()
        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "يجب تسجيل الدخول في التطبيق أولاً", Toast.LENGTH_LONG).show()
            return
        }

        var fullOrderText = rawText
        if (phone.isNotEmpty() && !fullOrderText.contains(phone)) {
            fullOrderText += "\nهاتف: $phone"
        }
        if (price.isNotEmpty() && !fullOrderText.contains(price)) {
            fullOrderText += "\nالسعر: $price"
        }

        val chosenPreparerId = selectedPreparerId ?: preparersList.firstOrNull()?.id

        pbSubmitOrder.visibility = View.VISIBLE
        btnSubmitOrderDirectly.isEnabled = false
        tvSubmitStatus.visibility = View.GONE

        val json = JSONObject().apply {
            put("text", fullOrderText)
            if (chosenPreparerId != null) {
                val prepArr = org.json.JSONArray()
                prepArr.put(chosenPreparerId)
                put("preparerIds", prepArr)
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
                    pbSubmitOrder.visibility = View.GONE
                    btnSubmitOrderDirectly.isEnabled = true
                    tvSubmitStatus.text = "❌ فشل الاتصال بالسيرفر: ${e.message}"
                    tvSubmitStatus.setTextColor(Color.parseColor("#EF4444"))
                    tvSubmitStatus.visibility = View.VISIBLE
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val resBody = response.body?.string() ?: ""
                runOnUiThread {
                    pbSubmitOrder.visibility = View.GONE
                    btnSubmitOrderDirectly.isEnabled = true

                    try {
                        val resJson = JSONObject(resBody)
                        if (response.isSuccessful && resJson.optBoolean("success")) {
                            tvSubmitStatus.text = "✅ تم إضافة وتثبيت الطلب بنجاح! 🎉"
                            tvSubmitStatus.setTextColor(Color.parseColor("#10B981"))
                            tvSubmitStatus.visibility = View.VISIBLE
                            etOrderRawText.setText("")
                            etCustomerPhone.setText("")
                            etOrderPrice.setText("")
                            Toast.makeText(this@FloatingAdminActivity, "تم إنشاء الطلب بنجاح في النظام", Toast.LENGTH_SHORT).show()
                        } else if (resJson.optBoolean("requireRegion")) {
                            // المنطقة تحتاج تحديد - يمكن توجيه أو تحديد تلقائي
                            tvSubmitStatus.text = "⚠️ يرجى كتابة اسم المنطقة بوضوح في تفاصيل الطلب"
                            tvSubmitStatus.setTextColor(Color.parseColor("#F59E0B"))
                            tvSubmitStatus.visibility = View.VISIBLE
                        } else {
                            val err = resJson.optString("error", "فشل إنشاء الطلب")
                            tvSubmitStatus.text = "❌ $err"
                            tvSubmitStatus.setTextColor(Color.parseColor("#EF4444"))
                            tvSubmitStatus.visibility = View.VISIBLE
                        }
                    } catch (e: Exception) {
                        tvSubmitStatus.text = "خطأ: ${e.message}"
                        tvSubmitStatus.setTextColor(Color.parseColor("#EF4444"))
                        tvSubmitStatus.visibility = View.VISIBLE
                    }
                }
            }
        })
    }

    private fun toggleFloatingBubbleService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "يرجى تفعيل صلاحية الظهور فوق التطبيقات لإبقاء الزر العائم", Toast.LENGTH_LONG).show()
            try {
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                startActivity(intent)
            } catch (e: Exception) {
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                startActivity(intent)
            }
            return
        }

        if (FloatingWidgetService.isRunning) {
            val stopIntent = Intent(this, FloatingWidgetService::class.java).apply {
                action = FloatingWidgetService.ACTION_HIDE
            }
            startService(stopIntent)
            Toast.makeText(this, "تم إخفاء الزر العائم الدائم", Toast.LENGTH_SHORT).show()
        } else {
            val startIntent = Intent(this, FloatingWidgetService::class.java).apply {
                action = FloatingWidgetService.ACTION_SHOW
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(startIntent)
            } else {
                startService(startIntent)
            }
            Toast.makeText(this, "تم تثبيت الزر العائم الدائم على الشاشة 🔘", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onResume() {
        super.onResume()
        try {
            val hideIntent = Intent(this, FloatingWidgetService::class.java).apply {
                action = FloatingWidgetService.ACTION_SET_INVISIBLE
            }
            startService(hideIntent)
        } catch (e: Exception) {}
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            val showIntent = Intent(this, FloatingWidgetService::class.java).apply {
                action = FloatingWidgetService.ACTION_SET_VISIBLE
            }
            startService(showIntent)
        } catch (e: Exception) {}
    }
}
