// Import page logic (Electron renderer)
// Uses API base from preload: window.env.API_BASE_URL
// Endpoints (override by setting window.env.ENDPOINTS in preload if needed)

document.addEventListener("DOMContentLoaded", () => {
  const tabSingle = document.getElementById("tabSingle");
  const tabImport = document.getElementById("tabImport");
  const panelSingle = document.getElementById("panelSingle");
  const panelImport = document.getElementById("panelImport");

  const add_product_name = document.getElementById("add_product_name");
  const add_sku = document.getElementById("add_sku");
  const add_unit = document.getElementById("add_unit");
  const add_factor = document.getElementById("add_factor");
  const add_price = document.getElementById("add_price");
  const add_stock = document.getElementById("add_stock");
  const add_warehouse = document.getElementById("add_warehouse");
  const saveSingle = document.getElementById("saveSingle");
  const msgSingle = document.getElementById("msgSingle");

  const importFileInput = document.getElementById("importFileInput");
  const uploadExcel = document.getElementById("uploadExcel");
  const msgImport = document.getElementById("msgImport");
  const importLogs = document.getElementById("importLogs");

  const statusText = (add_status.value || "").trim().toLowerCase();
  const status = statusText === "active" ? true : statusText === "inactive" ? false : true;

  function apiBase() {
    const base = window.env?.API_BASE_URL;
    return base ? base.replace(/\/$/, "") : null;
  }
  function ep(name, fallback) {
    return window.env?.ENDPOINTS?.[name] || fallback;
  }

  const ENDPOINTS = {
    IMPORT_EXCEL: ep("IMPORT_EXCEL", "/api/insert_product_service/excel"),
    // ถ้า backend มีเส้นนี้ จะใช้เพิ่มทีละรายการ/ส่ง batch JSON ได้
    INSERT_JSON: ep("INSERT_JSON", "/api/insert_product_service"),
  };

  // ใช้ server_excel เป็นหลัก (ตาม API ที่คุณมี)
  const IMPORT_MODE = (window.env?.IMPORT_MODE || "server_excel"); // "server_excel" | "client_chunk"
  const CHUNK_SIZE = Number(window.env?.CHUNK_SIZE || 500);

  let working = false;
  function setWorking(v) {
    working = v;
    saveSingle.disabled = v;
    uploadExcel.disabled = v;
  }

  function fmtTime(t) { return t ? new Date(t).toLocaleString() : "-"; }
  function logLine(html) { const div = document.createElement("div"); div.innerHTML = html; importLogs.appendChild(div); }

  function setTab(next) {
    panelSingle.classList.toggle("hidden", next !== "single");
    panelImport.classList.toggle("hidden", next !== "import");
    msgSingle.textContent = "";
    msgImport.textContent = "";
    importLogs.innerHTML = "";
  }
  tabSingle.addEventListener("click", () => setTab("single"));
  tabImport.addEventListener("click", () => setTab("import"));
  setTab("single");

  
  async function safeJson(res) {
    const raw = await res.text();
    try { return JSON.parse(raw); } catch {
      throw new Error(`API ไม่ได้ส่ง JSON (status ${res.status}): ${raw.slice(0, 200)}`);
    }
  }

  // ===== SINGLE INSERT (ต้องมี backend POST /api/insert_product_service) =====
  async function saveSingleHandler() {
    if (working) return;

    const sku = add_sku.value.trim();
    const product_name = add_product_name.value.trim();
    const unit = add_unit.value.trim();
    if (!sku) return (msgSingle.textContent = "กรุณากรอก SKU");
    if (!product_name) return (msgSingle.textContent = "กรุณากรอกชื่อสินค้า");
    if (!unit) return (msgSingle.textContent = "กรุณากรอก Unit");

    const base = apiBase();
    if (!base) return (msgSingle.textContent = "API_BASE_URL not set (ดู preload.js)");

    setWorking(true);
    msgSingle.textContent = "กำลังบันทึก...";

    try {
     const payload = {
        product: {
          sku,
          product_name,
          status: true,   // ✅ boolean
        },
        skus: [{
          sku,
          barcode: sku,
          unit,           // (ของคุณเป็น Number แล้ว)
          factor: Number(add_factor.value) || 1,
          price: Number(add_price.value) || 0,
          stock_qty: Number(add_stock.value) || 0,
          warehouse: add_warehouse.value.trim(),
          status: true,   // ✅ boolean
        }],
      };
      const res = await fetch(base + ENDPOINTS.INSERT_JSON, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || "Save failed");

      msgSingle.textContent = "บันทึกสำเร็จ ✅";
    } catch (err) {
      msgSingle.textContent = `ผิดพลาด: ${err.message || err}`;
    } finally {
      setWorking(false);
    }
  }
  saveSingle.addEventListener("click", saveSingleHandler);

  // ===== IMPORT: server parses excel (ตรงกับ API ที่คุณมี) =====
  async function importByServerExcel(file) {
    const base = apiBase(); if (!base) throw new Error("API_BASE_URL not set");
    msgImport.textContent = "กำลังอัปโหลดไฟล์...";
    importLogs.innerHTML = "";

    const fd = new FormData();
    fd.append("file", file);

    const uiStart = performance.now();
    const res = await fetch(base + ENDPOINTS.IMPORT_EXCEL, { method: "POST", body: fd });
    const data = await safeJson(res);
    const uiEnd = performance.now();

    if (!res.ok) throw new Error(data.message || "Import failed");

    logLine(`Mode: <b>server_excel</b> (POST ${ENDPOINTS.IMPORT_EXCEL})`);
    logLine(`Client time: ${((uiEnd - uiStart) / 1000).toFixed(2)} sec`);
    msgImport.textContent = "Import สำเร็จ ✅";
  }

  // ===== IMPORT: client chunk (ลดภาระ API ต่อ request) =====
  async function importByClientChunk(file) {
    if (typeof XLSX === "undefined") throw new Error("ไม่พบ XLSX ในหน้าเว็บ");
    const base = apiBase(); if (!base) throw new Error("API_BASE_URL not set");

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const totalRows = rows.length;
    if (!totalRows) throw new Error("ไฟล์ว่าง");

    // ต้องมี backend รับ JSON batch ที่ INSERT_JSON
    logLine(`Mode: <b>client_chunk</b> (ส่งทีละ ${CHUNK_SIZE} แถว ไป ${ENDPOINTS.INSERT_JSON})`);

    for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const res = await fetch(base + ENDPOINTS.INSERT_JSON, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: chunk }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || "batch failed");
      logLine(`✅ ส่งแล้ว ${Math.min(i + CHUNK_SIZE, totalRows)}/${totalRows}`);
    }

    msgImport.textContent = "Import สำเร็จ ✅";
  }

  uploadExcel.addEventListener("click", async () => {
    if (working) return;
    if (!importFileInput.files.length) return (msgImport.textContent = "กรุณาเลือกไฟล์ .xlsx หรือ .csv");
    setWorking(true);

    const file = importFileInput.files[0];
    const ext = (file.name.split(".").pop() || "").toLowerCase();

    try {
      if (IMPORT_MODE === "client_chunk") {
        if (ext !== "xlsx") throw new Error("โหมด client_chunk รองรับเฉพาะ .xlsx");
        await importByClientChunk(file);
      } else {
        await importByServerExcel(file);
      }
    } catch (e) {
      msgImport.textContent = `ผิดพลาด: ${e.message || e}`;
      logLine(`❌ <span class="text-rose-600">${e.message || e}</span>`);
    } finally {
      setWorking(false);
    }
  });
});
