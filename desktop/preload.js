const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("env", {
  API_BASE_URL: "http://localhost:3000"
});
