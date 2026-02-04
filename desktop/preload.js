const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("env", {
  API_BASE_URL: "https://poc-api.ops-nexus.com"
    // API_BASE_URL: "http://localhost:3000"

});
