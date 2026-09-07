package com.earnyst.app

import android.app.Application
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(ScreenTimeGuardPlugin::class.java)
        registerPlugin(ForegroundAppPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
    }
    companion object {
        lateinit var instance: App
    }
}