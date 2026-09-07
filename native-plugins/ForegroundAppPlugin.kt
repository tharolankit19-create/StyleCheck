package com.earnyst.app

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Foreground app detection via UsageStatsManager.
 *
 * Real blocking of third-party apps requires either:
 *  1) Device Owner / MDM APIs (production-grade), or
 *  2) An AccessibilityService that performs "global actions" (less robust).
 *
 * For the MVP we expose the query and the app uses Android's native focus
 * detection to know which app is currently in the foreground, then prompts
 * the user with a block screen if the wallet balance is zero and the
 * foreground app is in the user's blocked list. The full Device Owner path
 * is documented in PRODUCTION.md and enabled in production builds via
 * BuildConfig.FULL_DEVICE_OWNER.
 */
@CapacitorPlugin(name = "ForegroundApp")
class ForegroundAppPlugin : Plugin() {

    @PluginMethod
    fun getForegroundPackage(call: PluginCall) {
        try {
            val usm = context.getSystemService(android.content.Context.USAGE_STATS_SERVICE)
                    as android.app.usage.UsageStatsManager
            val now = android.os.System.currentTimeMillis()
            val events = android.app.usage.UsageEvents().apply {
                queryEvents(now - 5_000, now)
            }
            var lastPkg: String? = null
            var lastTs = 0L
            val ev = android.app.usage.UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(ev)
                if (ev.eventType == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    if (ev.timeStamp >= lastTs) {
                        lastTs = ev.timeStamp
                        lastPkg = ev.packageName
                    }
                }
            }
            val ret = com.getcapacitor.JSObject()
            ret.put("packageName", lastPkg ?: "unknown")
            ret.put("timestamp", lastTs)
            call.resolve(ret)
        } catch (e: Throwable) {
            call.reject("Usage stats unavailable", e)
        }
    }

    @PluginMethod
    fun hasUsagePermission(call: PluginCall) {
        try {
            val usm = context.getSystemService(android.content.Context.USAGE_STATS_SERVICE)
                    as android.app.usage.UsageStatsManager
            val now = android.os.System.currentTimeMillis()
            val stats = usm.queryUsageStats(
                android.app.usage.UsageStatsManager.INTERVAL_DAILY,
                now - 60_000,
                now,
            )
            val ret = com.getcapacitor.JSObject()
            ret.put("granted", stats != null && stats.isNotEmpty())
            call.resolve(ret)
        } catch (e: Throwable) {
            call.reject("Usage stats unavailable", e)
        }
    }
}