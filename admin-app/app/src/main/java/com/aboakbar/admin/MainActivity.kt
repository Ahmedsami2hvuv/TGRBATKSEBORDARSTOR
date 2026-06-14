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
        setContentView(R.layout.activity_main)

        // تهيئة OneSignal للإشعارات الفورية
        OneSignal.initWithContext(this, "aa21547a-4853-4ced-8823-6fd8c778b7b1")

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

        if (!savedToken.isNullOrEmpty()) {
            checkExistingToken(savedToken)
        } else {
            showLoginLayout()
        }

        // If biometric features are available and credentials are saved, show fingerprint option
        if (!savedPassword.isNullOrEmpty() && isBiometricAvailable()) {
            btnBiometric.visibility = View.VISIBLE
            // Automatically launch biometric prompt on startup if credentials exist
            biometricPrompt.authenticate(promptInfo)
        }

        // استرداد آخر رقم طلب مسجل وتفعيل قناة الإشعارات
        lastSeenOrderNumber = sharedPreferences.getInt("last_seen_order_number", 0)
        createNotificationChannel()

        requestAppPermissions()
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
                val intent = fileChooserParams?.createIntent() ?: return false
                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE)
                } catch (e: ActivityNotFoundException) {
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
            uploadMessage?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            uploadMessage = null
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
                        showLoginLayout()
                    }
                }
            }
        })
    }

    private fun launchDashboard(token: String) {
        currentToken = token
        startPolling()

        // ربط هوية الجهاز بـ admin_global لتلقي إشعارات الإدارة الفورية
        OneSignal.login("admin_global")

        // Programmatically inject cookie
        val cookieManager = CookieManager.getInstance()
        val cookieString = "admin_token=$token; Domain=aboakbar.vercel.app; Path=/; Secure; SameSite=Lax"
        cookieManager.setCookie(BACKEND_URL, cookieString)
        cookieManager.flush()

        // Hide Login and show WebView
        loginLayout.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.loadUrl(ADMIN_DASHBOARD_URL)
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
            super.onBackPressed()
        }
    }

    private fun startPolling() {
        if (isPollingActive) return
        isPollingActive = true
        pollingRunnable = object : Runnable {
            override fun run() {
                pollPendingOrders()
                pollingHandler.postDelayed(this, 10000) // فحص كل 10 ثوانٍ
            }
        }
        pollingHandler.post(pollingRunnable!!)
    }

    private fun stopPolling() {
        isPollingActive = false
        pollingRunnable?.let { pollingHandler.removeCallbacks(it) }
    }

    private fun pollPendingOrders() {
        val token = currentToken ?: return

        val request = Request.Builder()
            .url("$BACKEND_URL/api/notifications/admin-pending")
            .addHeader("Cookie", "admin_token=$token")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                // تجاهل أخطاء الشبكة المؤقتة
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) return
                val responseBody = response.body?.string() ?: return
                try {
                    val json = JSONObject(responseBody)
                    val pendingCount = json.optInt("pendingCount", 0)
                    val latestOrderNumber = json.optInt("latestOrderNumber", 0)

                    runOnUiThread {
                        if (latestOrderNumber > 0 && lastSeenOrderNumber > 0 && latestOrderNumber > lastSeenOrderNumber) {
                            lastSeenOrderNumber = latestOrderNumber
                            val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            sharedPreferences.edit().putInt("last_seen_order_number", lastSeenOrderNumber).apply()

                            showNativeNotification(latestOrderNumber, pendingCount)
                        } else if (latestOrderNumber > 0 && lastSeenOrderNumber == 0) {
                            lastSeenOrderNumber = latestOrderNumber
                            val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            sharedPreferences.edit().putInt("last_seen_order_number", lastSeenOrderNumber).apply()
                        }
                    }
                } catch (e: Exception) {
                    // تجاهل أخطاء التحليل
                }
            }
        })
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "إشعارات الطلبات"
            val descriptionText = "تنبيهات عند وصول طلبات جديدة للنظام"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableLights(true)
                enableVibration(true)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun showNativeNotification(orderNumber: Int, count: Int) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(this, 0, intent, flags)

        val title = "طلب جديد وارد! (#$orderNumber)"
        val body = "هناك طلب جديد معلق في النظام. إجمالي الطلبات المعلقة: $count"

        val notification = androidx.core.app.NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
            .setDefaults(androidx.core.app.NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(orderNumber, notification)
    }

    override fun onDestroy() {
        stopPolling()
        super.onDestroy()
    }
}
