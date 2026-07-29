import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app";
import "./globals.css";
import { registerSW } from "virtual:pwa-register";
import { SiteSettingsProvider } from "@/lib/site-settings";

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("新版本可用，是否重载页面更新？")) {
      updateSW();
    }
  },
  onOfflineReady() {
    console.log("App ready to work offline");
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SiteSettingsProvider>
      <App />
    </SiteSettingsProvider>
  </React.StrictMode>
);
