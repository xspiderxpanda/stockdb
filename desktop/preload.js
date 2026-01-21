const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("env", {
  API_BASE_URL: "https://poc-api.ops-nexus.com"
});
