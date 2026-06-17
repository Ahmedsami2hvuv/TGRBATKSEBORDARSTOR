package com.aboakbar.admin

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
import android.text.method.HideReturnsTransformationMethod
import android.text.method.PasswordTransformationMethod
import android.view.View
import android.webkit.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.Executor
import com.onesignal.OneSignal
import android.app.AlarmManager
import android.os.SystemClock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var loginLayout: View
    private lateinit var etPassword: EditText
    private lateinit var btnToggleVisibility: ImageView
    private lateinit var tvError: TextView
    private lateinit var btnSubmit: Button
    private lateinit var btnBiometric: ImageButton
    private lateinit var progressBar: ProgressBar

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token"
    private val KEY_PASSWORD = "admin_password" // Cached locally for biometric verification
    private val FILECHOOSER_RESULTCODE = 1
    private var uploadMessage: ValueCallback<Array<Uri>>? = null
    private var cameraImagePath: String? = null

    private var isPasswordVisible = false
    private lateinit var executor: Executor
    private lateinit var biometricPrompt: BiometricPrompt
    private lateinit var promptInfo: BiometricPrompt.PromptInfo

    private var lastSeenOrderNumber = 0
    private val pollingHandler = Handler(Looper.getMainLooper())
    private var pollingRunnable: Runnable? = null
    private val CHANNEL_ID = "aboakbar_admin_notifications"
    private var isPollingActive = false
    private var currentToken: String? = null

    private val BACKEND_URL = "https://aboakbar.vercel.app"
    private val ADMIN_DASHBOARD_URL = "$BACKEND_URL/abo1stor3hlaa2kbr8-47"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // منع نظام الأندرويد من إنشاء نسخة جديدة من التطبيق إذا كان مفتوحاً بالفعل
        if (!isTaskRoot && intent.hasCategory(Intent.CATEGORY_LAUNCHER) && intent.action != null && intent.action == Intent.ACTION_MAIN) {
            finish()
            return
        }
        
        setContentView(R.layout.activity_main)

        // تهيئة OneSignal للإشعارات الفورية
        OneSignal.initWithContext(this, "5c2acf6f-f2c0-40f2-830d-138f8a9e8c0a")

        // طلب إذن الإشعارات من وان سيجنال لتسجيل الجهاز بشكل صحيح في خوادمهم
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
        etPassword = findViewById(R.id.etPassword)
        btnToggleVisibility = findViewById(R.id.btnToggleVisibility)
        tvError = findViewById(R.id.tvError)
        btnSubmit = findViewById(R.id.btnSubmit)
        btnBiometric = findViewById(R.id.btnBiometric)
        progressBar = findViewById(R.id.progressBar)

        setupWebView()
        registerForContextMenu(webView)
        setupPasswordToggle()
        setupBiometrics()

        // Submit Button Click
        btnSubmit.setOnClickListener {
            val password = etPassword.text.toString().trim()
            if (password.isNotEmpty()) {
                performLogin(password)
            } else {
                showError("الرجاء إدخال كلمة المرور")
            }
        }

        // Biometric Button Click
        btnBiometric.setOnClickListener {
            biometricPrompt.authenticate(promptInfo)
        }

        // Check if token already exists and auto-login
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedToken = sharedPreferences.getString(KEY_TOKEN, null)
        val savedPassword = sharedPreferences.getString(KEY_PASSWORD, null)

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
            // نتحقق من الرمز فقط لضمان بقائه في الخلفية
            if (savedToken.isNullOrEmpty()) {
                showLoginLayout()
            } else {
                loginLayout.visibility = View.GONE
                webView.visibility = View.VISIBLE
            }
        } else {
            if (!savedToken.isNullOrEmpty()) {
                // دخول تلقائي مباشر دون إظهار نافذة البصمة المزعجة
                checkExistingToken(savedToken)
            } else {
                showLoginLayout()
                // إظهار البصمة التلقائية فقط إذا كان المستخدم في شاشة تسجيل الدخول ولديه بيانات مخزنة
                if (!savedPassword.isNullOrEmpty() && isBiometricAvailable()) {
                    btnBiometric.visibility = View.VISIBLE
                    biometricPrompt.authenticate(promptInfo)
                }
            }
        }

        // استرداد آخر رقم طلب مسجل
        lastSeenOrderNumber = sharedPreferences.getInt("last_seen_order_number", 0)

        requestAppPermissions()
        
        setupLongPressMenu()
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
                    // تجاهل فشل التوجيه للأجهزة النادرة
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

        // تفعيل التسريع العتادي لضمان سلاسة السحب (Scrolling) بدون ثقل
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        // Enable cookie manager
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith(BACKEND_URL) || url.contains("aboakbar.vercel.app") || url.startsWith("file:///android_asset")) {
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
                // Force sync cookies
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                // Optionally show error view if offline
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            // File Upload support (critical for importing/synchronizing in the dashboard)
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
                    // إذا لم يكن هناك بيانات فهذا يعني أن المستخدم التقط صورة من الكاميرا
                    if (cameraImagePath != null) {
                        results = arrayOf(Uri.fromFile(File(cameraImagePath)))
                    }
                } else {
                    // المستخدم اختار صورة من المعرض
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

    private fun setupPasswordToggle() {
        btnToggleVisibility.setOnClickListener {
            isPasswordVisible = !isPasswordVisible
            if (isPasswordVisible) {
                etPassword.transformationMethod = HideReturnsTransformationMethod.getInstance()
                btnToggleVisibility.setImageResource(android.R.drawable.ic_menu_close_clear_cancel) // standard back/hide icon fallback
            } else {
                etPassword.transformationMethod = PasswordTransformationMethod.getInstance()
                btnToggleVisibility.setImageResource(android.R.drawable.ic_menu_view)
            }
            etPassword.setSelection(etPassword.text.length)
        }
    }

    private fun isBiometricAvailable(): Boolean {
        val biometricManager = BiometricManager.from(this)
        return biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
    }

    private fun setupBiometrics() {
        executor = ContextCompat.getMainExecutor(this)
        biometricPrompt = BiometricPrompt(this, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    // Errors like cancellation, timeout
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    // Biometric passed, login using saved password
                    val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    val savedPassword = sharedPreferences.getString(KEY_PASSWORD, null)
                    if (!savedPassword.isNullOrEmpty()) {
                        performLogin(savedPassword)
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    showError("فشلت البصمة، يرجى المحاولة مجدداً")
                }
            })

        promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(getString(R.string.biometric_title))
            .setSubtitle(getString(R.string.biometric_subtitle))
            .setNegativeButtonText(getString(R.string.biometric_cancel))
            .build()
    }

    private fun performLogin(password: String) {
        showLoading(true)
        hideError()

        val json = JSONObject()
        json.put("password", password)

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url("$BACKEND_URL/api/admin-login")
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
                            val token = jsonRes.getString("token")

                            // Save token and passcode
                            val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            sharedPreferences.edit()
                                .putString(KEY_TOKEN, token)
                                .putString(KEY_PASSWORD, password) // save passcode for biometrics
                                .apply()

                            launchDashboard(token)
                        } catch (e: Exception) {
                            showError("خطأ في تحليل استجابة الخادم: ${e.message}")
                        }
                    } else {
                        try {
                            val jsonRes = JSONObject(responseBody)
                            val err = jsonRes.optString("error", "رمز المرور غير صحيح")
                            showError(err)
                        } catch (e: Exception) {
                            showError("رمز المرور السري غير صحيح!")
                        }
                    }
                }
            }
        })
    }

    private fun checkExistingToken(token: String) {
        showLoading(true)
        val request = Request.Builder()
            .url("$BACKEND_URL/api/admin-login?token=$token")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    showLoading(false)
                    // Network down, fallback to cache
                    launchDashboard(token)
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                runOnUiThread {
                    showLoading(false)
                    var isValid = false
                    try {
                        val jsonRes = JSONObject(responseBody)
                        isValid = jsonRes.getBoolean("valid")
                    } catch (e: Exception) {
                        // ignore
                    }

                    if (isValid) {
                        launchDashboard(token)
                    } else {
                        // Token expired, show login
                        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        sharedPreferences.edit().remove(KEY_TOKEN).apply()

                        // إيقاف الخدمة الأمامية عند انتهاء الجلسة أو تسجيل الخروج
                        try {
                            val serviceIntent = Intent(this@MainActivity, OrderForegroundService::class.java)
                            stopService(serviceIntent)
                        } catch (e: Exception) {
                            // تجاهل
                        }

                        showLoginLayout()
                    }
                }
            }
        })
    }

    private fun launchDashboard(token: String) {
        currentToken = token

        // تم إلغاء تشغيل الخدمة الخلفية (الفحص الدوري كل 15 ثانية) لتقليل استهلاك زيارات Vercel
        // وتجنب استنزاف الموارد، والاعتماد بالكامل على إشعارات OneSignal الفورية.
        /*
        try {
            val serviceIntent = Intent(this, OrderForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            // تجاهل
        }
        */

        // ربط هوية الجهاز بـ admin_global لتلقي إشعارات الإدارة الفورية
        OneSignal.login("admin_global")
        OneSignal.User.addTag("role", "admin")

        // Programmatically inject cookie
        val cookieManager = CookieManager.getInstance()
        val cookieString = "admin_token=$token; Domain=aboakbar.vercel.app; Path=/; Secure; SameSite=Lax"
        cookieManager.setCookie(BACKEND_URL, cookieString)
        cookieManager.flush()

        // Hide Login and show WebView
        loginLayout.visibility = View.GONE
        webView.visibility = View.VISIBLE

        val targetUrl = intent.getStringExtra("target_url") ?: ADMIN_DASHBOARD_URL
        webView.loadUrl(targetUrl)

        // التحقق من صلاحية التشغيل التلقائي (Auto-start) للهواتف التي تتطلب ذلك لضمان وصول الإشعارات فوراً
        checkAutoStartPermission()
    }

    private fun showLoginLayout() {
        webView.visibility = View.GONE
        loginLayout.visibility = View.VISIBLE
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        btnSubmit.isEnabled = !show
        btnBiometric.isEnabled = !show
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
            // بدلاً من إنهاء التطبيق بالكامل، نضعه في الخلفية لضمان عودته بشكل فوري
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
        val targetUrl = intent?.getStringExtra("target_url")
        if (!targetUrl.isNullOrEmpty() && webView.visibility == View.VISIBLE) {
            webView.loadUrl(targetUrl)
        }
    }

    override fun onResume() {
        super.onResume()
        // تم تعطيل webView.onResume() لمنع الشاشة البيضاء عند العودة

        // التحقق التدريجي من الصلاحيات الإضافية عند العودة للتطبيق
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (android.provider.Settings.canDrawOverlays(this)) {
                checkBatteryOptimizations()
            }
        }
    }

    override fun onPause() {
        super.onPause()
        // تم تعطيل webView.onPause() للحفاظ على استقرار التطبيق في الخلفية وجاهزيته الفورية
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
                
                // حفظ حالة السؤال لمنع تكراره وإزعاج المستخدم في كل مرة
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
                    Toast.makeText(this, "يرجى تفعيل (التشغيل التلقائي / Auto-start) لتطبيق أبو أكبر لضمان وصول الإشعارات فوراً في الخلفية", Toast.LENGTH_LONG).show()
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

    override fun onDestroy() {
        super.onDestroy()
    }
}
