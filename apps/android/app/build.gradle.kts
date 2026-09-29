plugins {
    id("com.android.application")
}

android {
    namespace = "ai.kryx.tablet"
    compileSdk = 35

    defaultConfig {
        applicationId = "ai.kryx.tablet"
        minSdk = 33
        targetSdk = 35
        versionCode = 120
        versionName = "1.2.0"

        buildConfigField("String", "KRYX_API_URL", "\"https://getkryxai.com\"")
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
        }
        release {
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources.excludes += setOf(
            "META-INF/DEPENDENCIES",
            "META-INF/LICENSE*",
            "META-INF/NOTICE*"
        )
    }
}
