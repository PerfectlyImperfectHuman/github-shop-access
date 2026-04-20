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
    androidScheme: "https",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#0d9668",
      sound: "beep.wav",
    },
  },
};

export default config;
