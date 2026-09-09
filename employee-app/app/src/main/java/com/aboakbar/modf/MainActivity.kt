package com.aboakbar.modf

import android.Manifest
import android.content.ActivityNotFoundException
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import com.onesignal.OneSignal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import android.provider.MediaStore
import androidx.core.content.FileProvider

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var loginLayout: View
    private lateinit var mainLayout: View
    private lateinit var etPassword: EditText // ويمثل هنا حقل "رابط بوابة الموظف"
    private lateinit var tvError: TextView
    private lateinit var btnSubmit: Button
    private lateinit var progressBar: ProgressBar

    private lateinit var layoutEmployeeQuickTools: View
    private lateinit var fabFloatingAssistant: com.google.android.material.floatingactionbutton.FloatingActionButton
    private lateinit var fabEvaluationCheck: com.google.android.material.floatingactionbutton.FloatingActionButton
    private lateinit var fabOutreachCheck: com.google.android.material.floatingactionbutton.FloatingActionButton

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token" // يُخزن فيه رابط بوابة الموظف بالكامل للاستمرار
    private val FILECHOOSER_RESULTCODE = 1
    private var uploadMessage: ValueCallback<Array<Uri>>? = null
    private var cameraImagePath: String? = null

    private var currentToken: String? = null

    private val BACKEND_URL = "https://aboakbr.com"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // منع نظام الأندرويد من إنشاء نسخة جديدة من التطبيق إذا كان مفتوحاً بالفعل
        if (!isTaskRoot && intent.hasCategory(Intent.CATEGORY_LAUNCHER) && intent.action != null && intent.action == Intent.ACTION_MAIN) {
            finish()
            return
        }
        
        setContentView(R.layout.activity_main)

        // تهيئة OneSignal للإشعارات الفورية لتطبيق الموظفين
        OneSignal.initWithContext(this, "5487c703-2ecb-487c-8a99-1af4eb7f945b")

        // طلب إذن الإشعارات من وان سيجنال
        CoroutineScope(Dispatchers.IO).launch {
            try {
                OneSignal.Notifications.requestPermission(true)
            } catch (e: Exception) {
                // تجاهل
            }
        }

        // Initialize Views
        webView = findViewById(R.id.webView)
        loginLayout = findViewById(R.id.loginLayout)
        mainLayout = findViewById(R.id.mainLayout)
        etPassword = findViewById(R.id.etPassword)
        tvError = findViewById(R.id.tvError)
        btnSubmit = findViewById(R.id.btnSubmit)
        progressBar = findViewById(R.id.progressBar)
        layoutEmployeeQuickTools = findViewById(R.id.layoutEmployeeQuickTools)
        fabFloatingAssistant = findViewById(R.id.fabFloatingAssistant)
        fabEvaluationCheck = findViewById(R.id.fabEvaluationCheck)
        fabOutreachCheck = findViewById(R.id.fabOutreachCheck)

        // زر تشغيل المساعد العائم
        fabFloatingAssistant.setOnClickListener {
            FloatingAssistantService.start(this)
            moveTaskToBack(true)
            Toast.makeText(this, "تم تشغيل المساعد العائم ⚡ (يعمل الآن فوق الواتساب وكافة التطبيقات)", Toast.LENGTH_SHORT).show()
        }

        // زر فحص مراسلة وتخزين الزبائن يدوياً (ونقر مطول لفتح إعدادات المؤقتات)
        fabOutreachCheck.setOnClickListener {
            OutreachSchedulerService.fetchAndTriggerOutreachAlert(this, isManual = true)
        }

        fabOutreachCheck.setOnLongClickListener {
            RemindersSettingsHelper.showCombinedSettingsDialog(this)
            true
        }

        // زر فحص طلبات التقييم المجدولة يدوياً (ونقر مطول لفتح إعدادات المؤقتات)
        fabEvaluationCheck.setOnClickListener {
            EvaluationSchedulerService.fetchAndTriggerEvaluationAlert(this, isManual = true)
        }

        fabEvaluationCheck.setOnLongClickListener {
            RemindersSettingsHelper.showCombinedSettingsDialog(this)
            true
        }

        setupWebView()
        setupDynamicShortcuts()

        // فحص ما إذا كان التطبيق مفتوحاً عبر اختصار المساعد العائم
        if (intent?.action == "ACTION_START_FLOATING_ASSISTANT") {
            FloatingAssistantService.start(this)
            finish()
            return
        }

        // فحص ما إذا كان التطبيق مفتوحاً لفتح إعدادات المؤقتات
        if (intent?.action == "com.aboakbar.modf.ACTION_OPEN_REMINDERS_SETTINGS") {
            RemindersSettingsHelper.showCombinedSettingsDialog(this)
        }

        // Submit Button Click
        btnSubmit.setOnClickListener {
            val portalUrl = etPassword.text.toString().trim()
            if (portalUrl.isNotEmpty()) {
                if (portalUrl.contains("se=") && portalUrl.contains("exp=") && portalUrl.contains("s=")) {
                    performLogin(portalUrl)
                } else {
                    showError("الرجاء إدخال رابط بوابة موظف صحيح يحتوي على المعلمات المطلوبة")
                }
            } else {
                showError("الرجاء إدخال رابط البوابة")
            }
        }

        // Check if token already exists and auto-login
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedPortalUrl = sharedPreferences.getString(KEY_TOKEN, null)

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
            if (savedPortalUrl.isNullOrEmpty()) {
                showLoginLayout()
            } else {
                showWebViewLayout()
            }
        } else {
            if (!savedPortalUrl.isNullOrEmpty()) {
                checkExistingToken(savedPortalUrl)
            } else {
                showLoginLayout()
            }
        }

        // تشغيل مجدول التقييمات ومجدول مراسلة الزبائن التلقائي فور فتح التطبيق
        if (EvaluationSchedulerService.isEnabled(this)) {
            EvaluationSchedulerService.scheduleNextEvaluation(this, EvaluationSchedulerService.getIntervalMinutes(this))
        }
        if (OutreachSchedulerService.isEnabled(this)) {
            OutreachSchedulerService.scheduleNextOutreach(this, OutreachSchedulerService.getIntervalMinutes(this))
        }

        requestAppPermissions()
        setupLongPressMenu()
    }

    private fun setupDynamicShortcuts() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
            try {
                val shortcutManager = getSystemService(android.content.pm.ShortcutManager::class.java)
                
                val shortcutFloating = android.content.pm.ShortcutInfo.Builder(this, "shortcut_floating_assistant")
                    .setShortLabel("المساعد العائم ⚡")
                    .setLongLabel("تشغيل المساعد العائم فوق التطبيقات")
                    .setIcon(android.graphics.drawable.Icon.createWithResource(this, android.R.drawable.ic_dialog_dialer))
                    .setIntent(Intent(this, MainActivity::class.java).apply {
                        action = "ACTION_START_FLOATING_ASSISTANT"
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    })
                    .build()

                val shortcutPrep = android.content.pm.ShortcutInfo.Builder(this, "shortcut_prep_order")
                    .setShortLabel("طلب تجهيز 🛒")
                    .setIcon(android.graphics.drawable.Icon.createWithResource(this, android.R.drawable.ic_input_add))
                    .setIntent(Intent(this, PreparationOrderActivity::class.java).apply {
                        action = Intent.ACTION_VIEW
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    })
                    .build()

                val shortcutDouble = android.content.pm.ShortcutInfo.Builder(this, "shortcut_double_order")
                    .setShortLabel("طلب ذو وجهتين ⇄")
                    .setIcon(android.graphics.drawable.Icon.createWithResource(this, android.R.drawable.ic_menu_directions))
                    .setIntent(Intent(this, DoubleOrderActivity::class.java).apply {
                        action = Intent.ACTION_VIEW
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    })
                    .build()

                val shortcutDraft = android.content.pm.ShortcutInfo.Builder(this, "shortcut_quick_draft")
                    .setShortLabel("طلب جديد 📝")
                    .setIcon(android.graphics.drawable.Icon.createWithResource(this, android.R.drawable.ic_menu_edit))
                    .setIntent(Intent(this, QuickDraftActivity::class.java).apply {
                        action = Intent.ACTION_VIEW
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    })
                    .build()

                shortcutManager?.dynamicShortcuts = listOf(shortcutFloating, shortcutPrep, shortcutDouble, shortcutDraft)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun requestAppPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val toRequest = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (toRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, toRequest.toTypedArray(), 101)
        } else {
            checkOverlayPermission()
        }
    }

    private fun checkOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!android.provider.Settings.canDrawOverlays(this)) {
                try {
                    val intent = Intent(
                        android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    startActivity(intent)
                    Toast.makeText(this, "يرجى تفعيل خيار (الظهور فوق التطبيقات الأخرى) لكي تعمل الإشعارات المنبثقة الإجبارية بنجاح", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    // تجاهل
                }
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 101) {
            checkOverlayPermission()
        }
    }

    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.textZoom = 100
        settings.mediaPlaybackRequiresUserGesture = false

        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false

        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.isVerticalFadingEdgeEnabled = false
        webView.isHorizontalFadingEdgeEnabled = false

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith(BACKEND_URL) || url.contains("aboakbar.vercel.app") || url.contains("aboakbr.com") || url.startsWith("file:///android_asset")) {
                    return false
                }
                if (url.startsWith("tel:")) {
                    try {
                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        return false
                    }
                }
                if (url.startsWith("whatsapp:") || url.contains("wa.me")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        val webUrl = if (url.startsWith("whatsapp://send?")) {
                            url.replace("whatsapp://send?", "https://api.whatsapp.com/send?")
                        } else url
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(webUrl))
                            startActivity(intent)
                            return true
                        } catch (ex: Exception) {
                            return false
                        }
                    }
                }
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                } catch (e: Exception) {
                    return false
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                CookieManager.getInstance().flush()
                injectPerformanceCss(view)
            }

            override fun onPageCommitVisible(view: WebView?, url: String?) {
                super.onPageCommitVisible(view, url)
                injectPerformanceCss(view)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                uploadMessage?.onReceiveValue(null)
                uploadMessage = filePathCallback
                
                val isCapture = fileChooserParams?.isCaptureEnabled ?: false

                if (isCapture) {
                    val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                    if (takePictureIntent.resolveActivity(packageManager) != null) {
                        var photoURI: Uri? = null
                        try {
                            val photoFile = createImageFile()
                            photoURI = FileProvider.getUriForFile(
                                this@MainActivity,
                                "${packageName}.fileprovider",
                                photoFile
                            )
                        } catch (e: Exception) {
                            photoURI = null
                        }
                        
                        if (photoURI != null) {
                            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoURI)
                            takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                            try {
                                startActivityForResult(takePictureIntent, FILECHOOSER_RESULTCODE)
                                return true
                            } catch (e: Exception) {
                                // fallback
                            }
                        }
                    }
                }

                val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }
                
                try {
                    startActivityForResult(contentSelectionIntent, FILECHOOSER_RESULTCODE)
                } catch (e: Exception) {
                    uploadMessage?.onReceiveValue(null)
                    uploadMessage = null
                    return false
                }
                return true
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (uploadMessage == null) return
            
            var results: Array<Uri>? = null
            if (resultCode == RESULT_OK) {
                if (data == null || data.data == null) {
                    if (cameraImagePath != null) {
                        results = arrayOf(Uri.fromFile(File(cameraImagePath)))
                    }
                } else {
                    val dataString = data.dataString
                    if (dataString != null) {
                        results = arrayOf(Uri.parse(dataString))
                    }
                }
            }
            uploadMessage?.onReceiveValue(results)
            uploadMessage = null
        }
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp: String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir: File? = getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES)
        return File.createTempFile("JPEG_${timeStamp}_", ".jpg", storageDir).apply {
            cameraImagePath = absolutePath
        }
    }

    private fun performLogin(portalUrl: String) {
        showLoading(true)
        hideError()

        val json = JSONObject()
        json.put("portalUrl", portalUrl)

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url("$BACKEND_URL/api/employee/login")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    showLoading(false)
                    showError("حدث خطأ في الاتصال بالشبكة: ${e.message}")
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                runOnUiThread {
                    showLoading(false)
                    if (response.isSuccessful) {
                        try {
                            val jsonRes = JSONObject(responseBody)
                            val staffObj = jsonRes.getJSONObject("staff")
                            
                            val staffId = staffObj.getString("id")
                            val se = staffObj.getString("se")
                            val exp = staffObj.getString("exp")
                            val sig = staffObj.getString("sig")
                            val name = staffObj.getString("name")

                            // حفظ البيانات محلياً
                            val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            sharedPreferences.edit()
                                .putString(KEY_TOKEN, portalUrl) // حفظ الرابط الكامل للدخول التلقائي
                                .putString("se", se)
                                .putString("exp", exp)
                                .putString("sig", sig)
                                .putString("staff_id", staffId)
                                .putString("staff_name", name)
                                .apply()

                            launchDashboard(portalUrl, staffId)
                        } catch (e: Exception) {
                            showError("خطأ في تحليل استجابة الخادم: ${e.message}")
                        }
                    } else {
                        try {
                            val jsonRes = JSONObject(responseBody)
                            val err = jsonRes.optString("error", "رابط البوابة غير صالح")
                            showError(err)
                        } catch (e: Exception) {
                            showError("رابط البوابة غير صالح أو الحساب معطل")
                        }
                    }
                }
            }
        })
    }

    private fun checkExistingToken(portalUrl: String) {
        showLoading(true)

        val json = JSONObject()
        json.put("portalUrl", portalUrl)

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url("$BACKEND_URL/api/employee/login")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    showLoading(false)
                    // في حال انقطاع الشبكة، نفتح البوابة محلياً كـ fallback
                    val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    val staffId = sharedPreferences.getString("staff_id", "") ?: ""
                    launchDashboard(portalUrl, staffId)
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                runOnUiThread {
                    showLoading(false)
                    var isValid = false
                    var staffId = ""
                    try {
                        val jsonRes = JSONObject(responseBody)
                        if (jsonRes.getBoolean("success")) {
                            isValid = true
                            staffId = jsonRes.getJSONObject("staff").getString("id")
                        }
                    } catch (e: Exception) {
                        // ignore
                    }

                    if (isValid) {
                        launchDashboard(portalUrl, staffId)
                    } else {
                        // الرابط لم يعد صالحاً
                        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        sharedPreferences.edit()
                            .remove(KEY_TOKEN)
                            .remove("se")
                            .remove("exp")
                            .remove("sig")
                            .remove("staff_id")
                            .remove("staff_name")
                            .apply()

                        showLoginLayout()
                    }
                }
            }
        })
    }

    private fun launchDashboard(portalUrl: String, staffId: String) {
        currentToken = portalUrl

        // ربط هوية الجهاز بـ OneSignal لتلقي إشعارات الموظف
        if (staffId.isNotEmpty()) {
            OneSignal.login(staffId)
        }

        // تشغيل مجدول التقييمات التلقائي الذكي للزبائن
        if (EvaluationSchedulerService.isEnabled(this)) {
            EvaluationSchedulerService.scheduleNextEvaluation(this, EvaluationSchedulerService.getIntervalMinutes(this))
        }

        showWebViewLayout()

        val targetUrl = intent.getStringExtra("target_url") ?: portalUrl
        webView.loadUrl(targetUrl)

        checkAutoStartPermission()
    }

    private fun showWebViewLayout() {
        loginLayout.visibility = View.GONE
        webView.visibility = View.VISIBLE
        layoutEmployeeQuickTools.visibility = View.VISIBLE
        mainLayout.background = null
    }

    private fun showLoginLayout() {
        webView.visibility = View.GONE
        layoutEmployeeQuickTools.visibility = View.GONE
        loginLayout.visibility = View.VISIBLE
        mainLayout.setBackgroundResource(R.drawable.gradient_bg)
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        btnSubmit.isEnabled = !show
    }

    private fun showError(msg: String) {
        tvError.text = msg
        tvError.visibility = View.VISIBLE
    }

    private fun hideError() {
        tvError.visibility = View.GONE
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.visibility == View.VISIBLE && webView.canGoBack()) {
            webView.goBack()
        } else {
            moveTaskToBack(true)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
        cameraImagePath?.let { outState.putString("cameraImagePath", it) }
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
        cameraImagePath = savedInstanceState.getString("cameraImagePath")
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent?.action == "com.aboakbar.modf.ACTION_OPEN_REMINDERS_SETTINGS") {
            RemindersSettingsHelper.showCombinedSettingsDialog(this)
        }
        val targetUrl = intent?.getStringExtra("target_url")
        if (!targetUrl.isNullOrEmpty() && webView.visibility == View.VISIBLE) {
            webView.loadUrl(targetUrl)
        }
    }

    override fun onResume() {
        super.onResume()
        try {
            // webView.onResume()
            // webView.resumeTimers()
            webView.requestFocus(View.FOCUS_DOWN)
            webView.requestFocusFromTouch()
            // webView.post { webView.invalidate() }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (android.provider.Settings.canDrawOverlays(this)) {
                checkBatteryOptimizations()
            }
        }
    }

    override fun onPause() {
        super.onPause()
        try {
            // webView.onPause()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun checkBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isBatteryPrompted = sharedPreferences.getBoolean("battery_prompted", false)
            
            if (!isBatteryPrompted) {
                val packageName = packageName
                val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                    sharedPreferences.edit().putBoolean("battery_prompted", true).apply()
                    try {
                        val intent = Intent().apply {
                            action = android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                            data = Uri.parse("package:$packageName")
                        }
                        startActivity(intent)
                        Toast.makeText(this, "يرجى اختيار (السماح / Allow) لتعطيل تحسين البطارية لضمان وصول الإشعارات بالخلفية دائماً", Toast.LENGTH_LONG).show()
                    } catch (e: Exception) {
                        try {
                            val intent = Intent().apply {
                                action = android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
                            }
                            startActivity(intent)
                        } catch (ex: Exception) {
                            // تجاهل
                        }
                    }
                }
            }
        }
    }

    private fun checkAutoStartPermission() {
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isAutoStartPrompted = sharedPreferences.getBoolean("autostart_prompted", false)
        
        if (!isAutoStartPrompted) {
            val manufacturer = Build.MANUFACTURER.lowercase()
            if (manufacturer.contains("xiaomi") || manufacturer.contains("oppo") || 
                manufacturer.contains("vivo") || manufacturer.contains("huawei")) {
                
                sharedPreferences.edit().putBoolean("autostart_prompted", true).apply()
                
                try {
                    val intent = Intent()
                    when {
                        manufacturer.contains("xiaomi") -> {
                            intent.component = android.content.ComponentName(
                                "com.miui.securitycenter",
                                "com.miui.permcenter.autostart.AutoStartManagementActivity"
                            )
                        }
                        manufacturer.contains("oppo") -> {
                            intent.component = android.content.ComponentName(
                                "com.coloros.safecenter",
                                "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                            )
                        }
                        manufacturer.contains("vivo") -> {
                            intent.component = android.content.ComponentName(
                                "com.vivo.permissionmanager",
                                "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
                            )
                        }
                        manufacturer.contains("huawei") -> {
                            intent.component = android.content.ComponentName(
                                "com.huawei.systemmanager",
                                "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
                            )
                        }
                    }
                    startActivity(intent)
                    Toast.makeText(this, "يرجى تفعيل (التشغيل التلقائي / Auto-start) لتطبيق الموظفين لضمان وصول الإشعارات فوراً في الخلفية", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    // تجاهل
                }
            }
        }
    }

    private fun setupLongPressMenu() {
        webView.setOnLongClickListener {
            val hitTestResult = webView.hitTestResult
            val url = hitTestResult.extra

            if (url == null) return@setOnLongClickListener false

            val options = mutableListOf<String>()
            val actions = mutableListOf<() -> Unit>()

            when (hitTestResult.type) {
                WebView.HitTestResult.IMAGE_TYPE,
                WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE -> {
                    options.add("حفظ الصورة")
                    actions.add { downloadImage(url) }

                    options.add("مشاركة رابط الصورة")
                    actions.add { shareImage(url) }

                    if (hitTestResult.type == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE) {
                        options.add("فتح الرابط في متصفح خارجي")
                        actions.add {
                            try {
                                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            } catch (e: Exception) {}
                        }

                        options.add("نسخ الرابط")
                        actions.add {
                            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("URL", url))
                            Toast.makeText(this@MainActivity, "تم نسخ الرابط", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                WebView.HitTestResult.SRC_ANCHOR_TYPE -> {
                    options.add("فتح في متصفح خارجي")
                    actions.add {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (e: Exception) {}
                    }

                    options.add("نسخ الرابط")
                    actions.add {
                        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("URL", url))
                        Toast.makeText(this@MainActivity, "تم نسخ الرابط", Toast.LENGTH_SHORT).show()
                    }
                }
                else -> return@setOnLongClickListener false
            }

            if (options.isNotEmpty()) {
                android.app.AlertDialog.Builder(this)
                    .setItems(options.toTypedArray()) { _, which ->
                        actions[which].invoke()
                    }
                    .show()
                return@setOnLongClickListener true
            }

            false
        }
    }

    private fun downloadImage(url: String) {
        try {
            if (url.startsWith("data:image")) {
                Toast.makeText(this, "لا يمكن تنزيل هذه الصورة لأنها مدمجة بالصفحة", Toast.LENGTH_SHORT).show()
                return
            }
            val request = android.app.DownloadManager.Request(Uri.parse(url))
            request.allowScanningByMediaScanner()
            request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            
            var fileName = android.webkit.URLUtil.guessFileName(url, null, null)
            if (!fileName.contains(".")) {
                fileName += ".jpg"
            }
            
            request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, "AboAkbar/$fileName")
            
            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, "جاري تنزيل الصورة إلى مجلد التنزيلات...", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "حدث خطأ أثناء التنزيل: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun shareImage(url: String) {
        val intent = Intent(Intent.ACTION_SEND)
        intent.type = "text/plain"
        intent.putExtra(Intent.EXTRA_TEXT, url)
        startActivity(Intent.createChooser(intent, "مشاركة الرابط"))
    }

    private fun injectPerformanceCss(view: WebView?) {
        val css = """
            * {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                box-shadow: none !important;
                text-shadow: none !important;
                transition: none !important;
                animation: none !important;
            }
            .kse-glass-card, [class*="glass"], [class*="card"] {
                background-color: #ffffff !important;
                border-color: #e2e8f0 !important;
            }
            .dark .kse-glass-card, .dark [class*="glass"], .dark [class*="card"] {
                background-color: #09090b !important;
                border-color: #27272a !important;
            }
            .kse-app-bg::before, .kse-app-bg::after {
                display: none !important;
            }
            body {
                background-color: #ffffff !important;
            }
            .dark body {
                background-color: #09090b !important;
            }
        """.trimIndent().replace("\n", " ")

        val js = "javascript:(function() {" +
                "var parent = document.getElementsByTagName('head').item(0);" +
                "var style = document.createElement('style');" +
                "style.type = 'text/css';" +
                "style.innerHTML = '$css';" +
                "parent.appendChild(style);" +
                "})()"
        view?.post {
            view.loadUrl(js)
        }
    }
}
