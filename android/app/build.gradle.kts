plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "sg.nasumchurch.shuttle"
    compileSdk = 36

    defaultConfig {
        applicationId = "sg.nasumchurch.shuttle"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["appLinkHost"] = "nasum-church-shuttle.vercel.app"

        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"${providers.gradleProperty("NASUM_API_BASE_URL").orElse("https://nasum-church-shuttle.vercel.app").get()}\"",
        )
        buildConfigField(
            "String",
            "LINE_LOGIN_CHANNEL_ID",
            "\"${providers.gradleProperty("LINE_LOGIN_CHANNEL_ID").orElse("").get()}\"",
        )
        buildConfigField(
            "String",
            "GOOGLE_ANDROID_CLIENT_ID",
            "\"${providers.gradleProperty("GOOGLE_ANDROID_CLIENT_ID").orElse("").get()}\"",
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(platform(libs.androidx.compose.bom))
    implementation(platform(libs.firebase.bom))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.firebase.messaging)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
