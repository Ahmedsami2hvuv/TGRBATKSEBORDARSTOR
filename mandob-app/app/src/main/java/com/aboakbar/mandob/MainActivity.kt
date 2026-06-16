package com.aboakbar.mandob

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.onesignal.OneSignal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var loginLayout: View
    private lateinit var etPassword: EditText
    private lateinit var tvError: TextView
    private lateinit var btnSubmit: Button
    private lateinit var progressBar: ProgressBar

    private val PREFS_NAME = "AboAkbarMandobPrefs"
    private val KEY_MANDOB_URL = "mandob_url"
    private val KEY_MANDOB_ID = "mandob_id"
    private val FILECHOOSER_RESULTCODE = 1
    private var uploadMessage: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null

    // التطبيق الخاص بالمندوبين
    private val ONESIGNAL_APP_ID = "628d3268-9fda-405d-8d07-12d026810b84"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // تهيئة OneSignal للإشعارات الفورية
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID)

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
        tvError = findViewById(R.id.tvError)
        btnSubmit = findViewById(R.id.btnSubmit)
        progressBar = findViewById(R.id.progressBar)

        setupWebView()

        // Submit Button Click
        btnSubmit.setOnClickListener {
            val url = etPassword.text.toString().trim()
            if (url.isNotEmpty()) {
                performLogin(url)
            } else {
                showError("الرجاء إدخال الرابط")
            }
        }

        // Check if url already exists
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedUrl = sharedPreferences.getString(KEY_MANDOB_URL, null)
        val savedId = sharedPreferences.getString(KEY_MANDOB_ID, null)

        if (!savedUrl.isNullOrEmpty() && !savedId.isNullOrEmpty()) {
            OneSignal.login(savedId)
            OneSignal.User.addTag("role", "mandob")
            if (savedInstanceState != null) {
                webView.visibility = View.VISIBLE
                loginLayout.visibility = View.GONE
                webView.restoreState(savedInstanceState)
                checkAutoStartPermission()
            } else {
                launchDashboard(savedUrl, savedId)
            }
        } else {
            showLoginLayout()
        }

        requestAppPermissions()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
        cameraPhotoUri?.let { outState.putString("cameraPhotoUri", it.toString()) }
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
        val uriStr = savedInstanceState.getString("cameraPhotoUri")
        if (uriStr != null) {
            cameraPhotoUri = Uri.parse(uriStr)
        }
    }

    private fun requestAppPermissions() {
        val permissions = mutableListOf(
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
                        Uri.parse("package:" + packageName)
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
                if (url.contains("aboakbar.vercel.app") || url.contains("aboakbr.com") || url.startsWith("file:///android_asset")) {
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
                    val cameraIntent = Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE)
                    if (cameraIntent.resolveActivity(packageManager) != null) {
                        var photoFile: java.io.File? = null
                        try {
                            photoFile = java.io.File.createTempFile("IMG_", ".jpg", getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES))
                            cameraPhotoUri = androidx.core.content.FileProvider.getUriForFile(
                                this@MainActivity,
                                "$packageName.fileprovider",
                                photoFile
                            )
                        } catch (e: Exception) {
                            photoFile = null
                        }
                        if (photoFile != null) {
                            cameraIntent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, cameraPhotoUri)
                            cameraIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                            try {
                                startActivityForResult(cameraIntent, FILECHOOSER_RESULTCODE)
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
            
            var result: Array<Uri>? = null
            if (resultCode == android.app.Activity.RESULT_OK) {
                if (data == null || data.data == null) {
                    // من المحتمل أنه استخدم الكاميرا
                    if (cameraPhotoUri != null) {
                        result = arrayOf(cameraPhotoUri!!)
                    }
                } else {
                    // استخدم المعرض
                    result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                }
            }
            uploadMessage?.onReceiveValue(result)
            uploadMessage = null
        }
    }

    private fun performLogin(url: String) {
        showLoading(true)
        hideError()

        if (!url.startsWith("http")) {
            showLoading(false)
            showError("الرابط غير صحيح، يجب أن يبدأ بـ http أو https")
            return
        }

        if (!url.contains("mandoub")) {
            showLoading(false)
            showError("هذا ليس رابط مندوب صحيح.")
            return
        }

        try {
            // استخراج معرف المندوب من الرابط
            val uri = Uri.parse(url)
            var mandobId: String? = null

            // المحاولة الأولى: استخراج المعرف من المتغير c في الرابط (مثل ?c=ID)
            mandobId = uri.getQueryParameter("c")

            // المحاولة الثانية: استخراج المعرف من مسار الرابط (مثل /mandoub/ID)
            if (mandobId.isNullOrEmpty()) {
                val segments = uri.pathSegments
                val mandoubIndex = segments.indexOf("mandoub")
                if (mandoubIndex != -1 && mandoubIndex + 1 < segments.size) {
                    mandobId = segments[mandoubIndex + 1]
                }
            }

            if (!mandobId.isNullOrEmpty()) {
                // حفظ الرابط والـ ID
                val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                sharedPreferences.edit()
                    .putString(KEY_MANDOB_URL, url)
                    .putString(KEY_MANDOB_ID, mandobId)
                    .apply()

                launchDashboard(url, mandobId)
            } else {
                showLoading(false)
                showError("تعذر استخراج معرف المندوب من الرابط.")
            }
        } catch (e: Exception) {
            showLoading(false)
            showError("الرابط غير صحيح.")
        }
    }

    private fun launchDashboard(url: String, mandobId: String) {
        OneSignal.login(mandobId)
        OneSignal.User.addTag("role", "mandob")

        loginLayout.visibility = View.GONE
        webView.visibility = View.VISIBLE

        val targetUrl = intent.getStringExtra("target_url") ?: url
        webView.loadUrl(targetUrl)

        checkAutoStartPermission()
    }

    private fun showLoginLayout() {
        webView.visibility = View.GONE
        loginLayout.visibility = View.VISIBLE
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
            super.onBackPressed()
        }
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
        try {
            webView.onResume()
        } catch (e: Exception) {}

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (android.provider.Settings.canDrawOverlays(this)) {
                checkBatteryOptimizations()
            }
        }
    }

    override fun onPause() {
        try {
            webView.onPause()
        } catch (e: Exception) {}
        super.onPause()
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
                            data = Uri.parse("package:" + packageName)
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
                    Toast.makeText(this, "يرجى تفعيل (التشغيل التلقائي / Auto-start) لتطبيق المندوب لضمان وصول الإشعارات فوراً في الخلفية", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    // تجاهل
                }
            }
        }
    }
}
