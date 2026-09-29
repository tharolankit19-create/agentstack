plugins {
    id("com.android.application")
}

val taskSigningPublicKeyB64 = providers.gradleProperty("kryxTaskSigningPublicKeyB64")
    .orElse(providers.environmentVariable("KRYX_TASK_SIGNING_PUBLIC_KEY_B64"))
    .orElse("")
    .get()

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
        buildConfigField(
            "String",
            "KRYX_TASK_SIGNING_PUBLIC_KEY_B64",
            "\"\${taskSigningPublicKeyB64}\""
        )
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

    buildFeatures {
        buildConfig = true
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
