package com.earnyst.app

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ScreenTimeGuard")
class ScreenTimeGuardPlugin : Plugin() {

    override fun load() {
        super.load()
        Log.i(TAG, "ScreenTimeGuard loaded")
    }

    /**
     * Returns an elapsedRealtime (ms) that the JS side can compare against
     * Date.now() to detect wall-clock rollback attempts. We always return
     * SystemClock.elapsedRealtime() which cannot be manipulated by users
     * without root and is monotonic across reboots on modern Android.
     */
    @PluginMethod
    fun getElapsedRealtime(call: PluginCall) {
        val ret = JSObject()
        ret.put("elapsedRealtime", SystemClock.elapsedRealtime())
        ret.put("uptime", SystemClock.uptimeMillis())
        call.resolve(ret)
    }

    /**
     * Returns the package name list of user-installed apps that the user has
     * marked as "distracting" inside the app. In a production build we would
     * use UsageStatsManager / AccessibilityService for true enforcement;
     * this exposes the basic query the JS layer can use to mirror state.
     */
    @PluginMethod
    fun listInstalledApps(call: PluginCall) {
        val pm = context.packageManager
        val flags = android.content.pm.PackageManager.GET_META_DATA
        val installed = pm.getInstalledApplications(flags)
        val apps = JSObject()
        val list = com.getcapacitor.JSArray()
        installed.forEach { info ->
            if ((info.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) == 0) {
                val obj = JSObject()
                obj.put("packageName", info.packageName)
                obj.put("label", pm.getApplicationLabel(info).toString())
                list.put(obj)
            }
        }
        apps.put("apps", list)
        call.resolve(apps)
    }

    /**
     * Opens the system settings screen that allows the user to grant the
     * Usage Access permission (required for blocking apps). We can never
     * silently enable it.
     */
    @PluginMethod
    fun openUsageAccessSettings(call: PluginCall) {
        try {
            val intent = android.content.Intent(android.provider.Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
            call.resolve()
        } catch (e: Throwable) {
            call.reject("Unable to open settings", e)
        }
    }

    companion object {
        private const val TAG = "ScreenTimeGuard"
    }
}