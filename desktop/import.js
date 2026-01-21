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

let mode = "single";
let working = false;

function setTab(next) {
  mode = next;
  panelSingle.classList.toggle("hidden", next !== "single");
  panelImport.classList.toggle("hidden", next !== "import");

  tabSingle.classList.toggle("bg-slate-900", next === "single");
  tabSingle.classList.toggle("text-white", next === "single");
  tabSingle.classList.toggle("border", next !== "single");
  tabSingle.classList.toggle("border-slate-200", next !== "single");
  tabSingle.classList.toggle("bg-white", next !== "single");
  tabSingle.classList.toggle("text-slate-700", next !== "single");

  tabImport.classList.toggle("bg-slate-900", next === "import");
  tabImport.classList.toggle("text-white", next === "import");
  tabImport.classList.toggle("border", next !== "import");
  tabImport.classList.toggle("border-slate-200", next !== "import");
  tabImport.classList.toggle("bg-white", next !== "import");
  tabImport.classList.toggle("text-slate-700", next !== "import");

  msgSingle.textContent = "";
  msgImport.textContent = "";
  importLogs.innerHTML = "";
}

tabSingle.onclick = () => setTab("single");
tabImport.onclick = () => setTab("import");

function fmtTime(t) {
  return t ? new Date(t).toLocaleString() : "-";
}
function logLine(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  importLogs.appendChild(div);
}

function setWorking(v) {
  working = v;
  saveSingle.disabled = v;
  uploadExcel.disabled = v;
  saveSingle.classList.toggle("opacity-60", v);
  uploadExcel.classList.toggle("opacity-60", v);
}

saveSingle.onclick = async () => {
  if (working) return;

  const sku = add_sku.value.trim();
  const product_name = add_product_name.value.trim();
  const unit = add_unit.value.trim();

  if (!sku) return (msgSingle.textContent = "กรุณากรอก SKU");
  if (!product_name) return (msgSingle.textContent = "กรุณากรอกชื่อสินค้า");
  if (!unit) return (msgSingle.textContent = "กรุณากรอก Unit");

  setWorking(true);
  msgSingle.textContent = "กำลังบันทึก...";

  try {
    const res = await fetch(`${window.env.API_BASE_URL}/api/search_product_service`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: { sku, product_name },
        skus: [{
          sku,
          barcode: sku,
          unit,
          factor: Number(add_factor.value) || 1,
          price: Number(add_price.value) || 0,
          stock_qty: Number(add_stock.value) || 0,
          warehouse: add_warehouse.value.trim(),
        }],
      }),
    });

    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(raw.slice(0, 120)); }

    if (!res.ok) throw new Error(data.message || "Save failed");
    msgSingle.textContent = "บันทึกสำเร็จ ✅";
  } catch (e) {
    msgSingle.textContent = `ผิดพลาด: ${e.message}`;
  } finally {
    setWorking(false);
  }
};

uploadExcel.onclick = async () => {
  if (working) return;
  if (!importFileInput.files.length) return (msgImport.textContent = "กรุณาเลือกไฟล์ .xlsx");

  setWorking(true);
  msgImport.textContent = "กำลังอัปโหลด...";
  importLogs.innerHTML = "";

  const fd = new FormData();
  fd.append("file", importFileInput.files[0]);

  const uiStart = performance.now();

  try {
    const res = await fetch(`${window.env.API_BASE_URL}/api/insert_product_service/excel`, {
      method: "POST",
      body: fd,
    });

    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`API ไม่ได้ส่ง JSON: ${raw.slice(0, 120)}`); }

    const uiEnd = performance.now();

    if (!res.ok) throw new Error(data.message || "Import failed");

    const startAt = data.timing?.startAt || data.started_at;
    const endAt = data.timing?.endAt || data.finished_at;
    const durationMs = data.timing?.durationMs ?? data.duration_ms ?? null;

    logLine(`Request ID: <span class="font-mono">${data.request_id || "-"}</span>`);
    logLine(`Start: ${fmtTime(startAt)}`);
    logLine(`End: ${fmtTime(endAt)}`);
    logLine(`Server time: ${durationMs != null ? (Number(durationMs) / 1000).toFixed(2) + " sec" : "-"}`);
    logLine(`Client time: ${((uiEnd - uiStart) / 1000).toFixed(2)} sec`);

    const totalRows = data.summary?.total_rows ?? "-";
    const importedRows = data.summary?.imported_rows ?? "-";
    const failedRows = data.summary?.failed_rows ?? "-";
    logLine(`Imported: ${importedRows} / ${totalRows}`);
    logLine(`Failed: ${failedRows}`);

    if (Array.isArray(data.failed) && data.failed.length) {
      const preview = data.failed.slice(0, 8).map(f => `#${f.row}: ${f.reason}`).join("<br/>");
      logLine(`<div class="mt-2 text-xs text-rose-600">ตัวอย่างที่พลาด:<br/>${preview}</div>`);
    }

    msgImport.textContent = "Import สำเร็จ ✅";
  } catch (e) {
    msgImport.textContent = `ผิดพลาด: ${e.message}`;
  } finally {
    setWorking(false);
  }
};

setTab("single");
