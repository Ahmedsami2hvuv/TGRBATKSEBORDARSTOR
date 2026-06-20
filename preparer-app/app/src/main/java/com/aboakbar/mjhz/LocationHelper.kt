package com.aboakbar.mjhz

import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Bundle
import android.os.Looper
import android.util.Log
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException

object LocationHelper {
    private const val TAG = "LocationHelper"
    private val client = OkHttpClient()

    fun fetchAndSendLocation(context: Context) {
        val sharedPreferences = context.getSharedPreferences("AboAkbarPrefs", Context.MODE_PRIVATE)
        val savedUrl = sharedPreferences.getString("preparer_url", null) ?: return
        val savedId = sharedPreferences.getString("preparer_id", null) ?: return

        try {
            val uri = Uri.parse(savedUrl)
            val p = uri.getQueryParameter("p") ?: savedId
            val exp = uri.getQueryParameter("exp") ?: ""
            val s = uri.getQueryParameter("s") ?: ""
            val scheme = uri.scheme ?: "https"
            val host = uri.host ?: return
            val port = if (uri.port != -1) ":${uri.port}" else ""
            val baseUrl = "$scheme://$host$port"

            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

            // التحقق من الصلاحيات
            if (androidx.core.content.ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.ACCESS_FINE_LOCATION
                ) != android.content.pm.PackageManager.PERMISSION_GRANTED &&
                androidx.core.content.ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
                ) != android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                Log.e(TAG, "No location permission")
                return
            }

            // محاولة جلب آخر موقع معروف أولاً كحل سريع
            val lastGpsLoc = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            val lastNetLoc = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            var bestLocation = getBetterLocation(lastGpsLoc, lastNetLoc)

            if (bestLocation != null && (System.currentTimeMillis() - bestLocation.time) < 60000) {
                // إذا كان الموقع حديثاً (أقل من دقيقة)، نرسله فوراً وتكتمل العملية
                sendLocationToServer(baseUrl, p, exp, s, bestLocation.latitude, bestLocation.longitude)
                return
            }

            // طلب تحديث موقع لمرة واحدة
            val locationListener = object : LocationListener {
                private var isSent = false
                
                override fun onLocationChanged(location: Location) {
                    if (!isSent) {
                        isSent = true
                        sendLocationToServer(baseUrl, p, exp, s, location.latitude, location.longitude)
                        try {
                            locationManager.removeUpdates(this)
                        } catch (e: Exception) {
                            // تجاهل
                        }
                    }
                }
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }

            // الاستماع من كلا المصدرين لضمان الاستجابة السريعة
            var hasStartedUpdates = false
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    0L,
                    0f,
                    locationListener,
                    Looper.getMainLooper()
                )
                hasStartedUpdates = true
            }
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    0L,
                    0f,
                    locationListener,
                    Looper.getMainLooper()
                )
                hasStartedUpdates = true
            }

            // إذا تعذر تشغيل أي مزود، نرسل آخر موقع معروف حتى لو كان قديماً
            if (!hasStartedUpdates && bestLocation != null) {
                sendLocationToServer(baseUrl, p, exp, s, bestLocation.latitude, bestLocation.longitude)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error in fetchAndSendLocation", e)
        }
    }

    private fun getBetterLocation(loc1: Location?, loc2: Location?): Location? {
        if (loc1 == null) return loc2
        if (loc2 == null) return loc1
        return if (loc1.time > loc2.time) loc1 else loc2
    }

    private fun sendLocationToServer(baseUrl: String, p: String, exp: String, s: String, lat: Double, lng: Double) {
        val url = "$baseUrl/api/preparer/location"
        val json = JSONObject()
        json.put("p", p)
        if (exp.isNotEmpty()) json.put("exp", exp)
        json.put("s", s)
        json.put("lat", lat)
        json.put("lng", lng)

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url(url)
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Failed to send location to server", e)
            }
            override fun onResponse(call: Call, response: Response) {
                response.close()
                Log.d(TAG, "Location sent successfully")
            }
        })
    }
}
