import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bahi.digitalkhata",
  appName: "Bahi - Digital Khata",
  webDir: "dist",

  android: {
    buildOptions: {
      releaseType: "APK",
    },
  },

  server: {
    // https scheme is REQUIRED — Firebase Auth (PBKDF2, crypto.subtle)
    // only works in secure contexts. Without this, WebCrypto is undefined.
    androidScheme: "https",

    // Fixed hostname so Firebase authDomain allowlist works.
    // Add "bahi.digitalkhata" to your Firebase Console →
    // Authentication → Settings → Authorized domains
    hostname: "bahi.digitalkhata",

    // Allow cleartext for local dev only (not needed for prod APK)
    // cleartext: false,
  },

  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#0d9668",
      sound: "beep.wav",
    },

    // Capacitor HTTP plugin bypass — routes Firebase SDK requests
    // through the native layer instead of the WebView's fetch,
    // which prevents service worker interception of Firebase calls.
    // This fixes the "service worker intercepting Firebase network calls" bug.
    CapacitorHttp: {
      enabled: false, // Keep false — Firebase SDK handles its own networking
    },
  },
};

export default config;
