const keywordInput = document.getElementById("keywordInput");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");

const resultBody = document.getElementById("resultBody");
const showingCount = document.getElementById("showingCount");
const resultMeta = document.getElementById("resultMeta");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");

let currentPage = 1;
let isImporting = false;
const limit = 10;

// ---------- helpers ----------
function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function createUnitSelect(skus, onChange) {
  const select = document.createElement("select");
  select.className = "unit-select";

  skus.forEach((s, index) => {
    const opt = document.createElement("option");
    opt.value = index; // index ของ skus[]
    opt.textContent = `${s.unit}`;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    const selected = skus[select.value];
    onChange(selected);
  });

  return select;
}


function setLoadingTable() {
  resultBody.innerHTML = `
    <tr><td colspan="6" class="py-10 text-center text-slate-400">กำลังค้นหา...</td></tr>
  `;
}

function setEmptyTable(msg = "Not found") {
  resultBody.innerHTML = `
    <tr><td colspan="6" class="py-10 text-center text-slate-400">${msg}</td></tr>
  `;
}

function fmtPrice(v) {
  if (v === undefined || v === null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString();
}


function addRow(tbody, product) {
  if (!product.skus || product.skus.length === 0) return;

  const tr = document.createElement("tr");

  // ใช้ unit แรกเป็น default
  let currentSku = product.skus[0];

  // ===== ชื่อสินค้า =====
  const tdName = document.createElement("td");
  tdName.textContent = product.product_name;
  tr.appendChild(tdName);

  // ===== SKU =====
  const tdSku = document.createElement("td");
  tdSku.textContent = currentSku.sku;
  tr.appendChild(tdSku);

  // ===== UNIT (SELECT) =====
  const tdUnit = document.createElement("td");
  const unitSelect = createUnitSelect(product.skus, (selected) => {
    currentSku = selected;

    priceSpan.textContent = selected.price;
    factorSpan.textContent = selected.factor;
    stockSpan.textContent = selected.stock_qty;
  });
  tdUnit.appendChild(unitSelect);
  tr.appendChild(tdUnit);

  // ===== FACTOR =====
  const tdFactor = document.createElement("td");
  const factorSpan = document.createElement("span");
  factorSpan.textContent = currentSku.factor;
  tdFactor.appendChild(factorSpan);
  tr.appendChild(tdFactor);

  // ===== PRICE =====
  const tdPrice = document.createElement("td");
  const priceSpan = document.createElement("span");
  priceSpan.textContent = currentSku.price;
  tdPrice.appendChild(priceSpan);
  tr.appendChild(tdPrice);

  // ===== STOCK =====
  const tdStock = document.createElement("td");
  const stockSpan = document.createElement("span");
  stockSpan.textContent = currentSku.stock_qty;
  tdStock.appendChild(stockSpan);
  tr.appendChild(tdStock);

  tbody.appendChild(tr);
}


// ---------- SEARCH ----------
async function search(page = 1) {
  const keyword = keywordInput.value.trim();
  currentPage = page;

  setLoadingTable();
  showingCount.textContent = "0";
  resultMeta.textContent = "กำลังค้นหา...";

  const t0 = performance.now();
  const res = await fetch(
    `${window.env.API_BASE_URL}/api/search_product_service/search?keyword=${encodeURIComponent(
      keyword || ""
    )}&page=${page}&limit=${limit}`
  );
  const data = await res.json();
  const tookMs = Math.round(performance.now() - t0);

  if (!res.ok) {
    setEmptyTable("ค้นหาไม่สำเร็จ");
    return;
  }

 resultBody.innerHTML = "";
let rows = 0;

data.items.forEach((p) => {
  addRow(resultBody, p);
  rows++;
});


  if (rows === 0) setEmptyTable("ไม่พบข้อมูล");

  showingCount.textContent = rows;
  pageInfo.textContent = `Page ${data.page} / ${data.totalPages}`;
  prevBtn.disabled = data.page <= 1;
  nextBtn.disabled = data.page >= data.totalPages;
  resultMeta.textContent = `${data.total} รายการ • ${tookMs} ms`;
}

// realtime search
const debouncedSearch = debounce(() => search(1), 300);
keywordInput.addEventListener("input", debouncedSearch);
searchBtn.onclick = () => search(1);
prevBtn.onclick = () => search(currentPage - 1);
nextBtn.onclick = () => search(currentPage + 1);

clearBtn.onclick = () => {
  keywordInput.value = "";
  search(1);
  setEmptyTable("ค้นหาสินค้าจาก BarCode , SKU ฯลฯ");
  showingCount.textContent = "0";
  pageInfo.textContent = "Page 0 / 0";
  resultMeta.textContent = "พร้อมค้นหา";
};

// ================= MODAL =================
const modalOverlay = document.getElementById("modalOverlay");
const openAddBtn = document.getElementById("openAddBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelAddBtn = document.getElementById("cancelAddBtn");
const saveAddBtn = document.getElementById("saveAddBtn");
const addMsg = document.getElementById("addMsg");

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

const importFileInput = document.getElementById("importFileInput");

let addMode = "single";

// ---------- import state ----------
function setImportState(working) {
  isImporting = working;
  saveAddBtn.disabled = working;
  cancelAddBtn.disabled = working;
  closeModalBtn.disabled = working;
  saveAddBtn.classList.toggle("opacity-60", working);
  saveAddBtn.classList.toggle("cursor-not-allowed", working);
}

function nowISO() {
  return new Date().toISOString();
}
function fmtTime(t) {
  return t ? new Date(t).toLocaleString() : "-";
}
function logLine(html) {
  addMsg.innerHTML += `<div class="mt-1">${html}</div>`;
}

modalOverlay.addEventListener("click", (e) => {
  if (isImporting) return;
  if (e.target === modalOverlay) closeModal();
});

openAddBtn.onclick = () => {
  modalOverlay.classList.remove("hidden");
  modalOverlay.classList.add("flex");
  setTab("single");
};
closeModalBtn.onclick = closeModal;
cancelAddBtn.onclick = closeModal;
tabSingle.onclick = () => setTab("single");
tabImport.onclick = () => setTab("import");

function setTab(mode) {
  addMode = mode;
  addMsg.innerHTML = "Waiting";
  panelSingle.classList.toggle("hidden", mode !== "single");
  panelImport.classList.toggle("hidden", mode !== "import");
  saveAddBtn.textContent = mode === "single" ? "บันทึก" : "อัปโหลด";
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modalOverlay.classList.remove("flex");
}


saveAddBtn.onclick = async () => {
  // ================= SINGLE MODE =================
  if (addMode === "single") {
    addMsg.innerHTML = ""; // reset เฉพาะตอนเข้า single

    const sku = add_sku.value.trim();
    const product_name = add_product_name.value.trim();

    // ---------- VALIDATION ----------
    if (!sku && !product_name) {
      addMsg.innerHTML =
        `<span class="text-rose-600">กรุณากรอกข้อมูลสินค้า</span>`;
      return;
    }
  
     if (!sku) {
      addMsg.innerHTML =
        `<span class="text-rose-600">กรุณากรอก SKU สินค้า</span>`;
        add_sku.focus();
      return;
    }

    if (!product_name) {
      addMsg.innerHTML =
        `<span class="text-rose-600">กรุณากรอก Product Name</span>`;
      add_product_name.focus();
      return;
    }

    // ---------- SAVE ----------
    addMsg.innerHTML =
      `<span class="text-slate-500">กำลังบันทึก...</span>`;

    try {
      const res = await fetch(`${window.env.API_BASE_URL}/api/search_product_service`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: { sku, product_name },
          skus: [
            {
              sku,
              barcode: sku,
              unit: add_unit.value.trim(),
              factor: Number(add_factor.value) || 1,
              price: Number(add_price.value) || 0,
              stock_qty: Number(add_stock.value) || 0,
              warehouse: add_warehouse.value.trim(),
            },
          ],
        }),
      });

      const ct = res.headers.get("content-type") || "";
const raw = await res.text();

let data;
if (ct.includes("application/json")) {
  data = JSON.parse(raw);
} else {
  throw new Error(`API ไม่ได้ส่ง JSON กลับมา (status ${res.status}) : ${raw.slice(0, 120)}`);
}

if (!res.ok) throw new Error(data.message || "Save failed");

      addMsg.innerHTML =
        `<span class="text-emerald-600">บันทึกสำเร็จ</span>`;

      await search(1);
      setTimeout(closeModal, 400);

    } catch (err) {
      addMsg.innerHTML =
        `<span class="text-rose-600">ผิดพลาด : ${err.message}</span>`;
    }

    return;
  }

  // ================= IMPORT MODE =================
  if (addMode === "import") {
    if (isImporting) return;

    addMsg.innerHTML = "";

    if (!importFileInput.files.length) {
      addMsg.innerHTML =
        `<span class="text-rose-600">กรุณาเลือกไฟล์ .xlsx</span>`;
      return;
    }

    setImportState(true);

    const clientStart = nowISO();
    logLine(`Client เริ่ม upload : ${fmtTime(clientStart)}`);

    const fd = new FormData();
    fd.append("file", importFileInput.files[0]);
    const uiStart = performance.now();

    try {
      const res = await fetch(`${window.env.API_BASE_URL}/api/insert_product_service/excel`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Import failed");

      const uiEnd = performance.now();
      logLine(`Start : ${fmtTime(data.timing?.started_at || data.started_at)}`);
      logLine(`End : ${fmtTime(data.timing?.finished_at || data.finished_at)}`);

      const durationSec =
        data.timing?.durationSec ??
        (data.duration_ms ? (data.duration_ms / 1000).toFixed(2) : "-");

      logLine(`Processing time : ${durationSec} sec`);
      logLine(`Client Processing time : ${((uiEnd - uiStart) / 1000).toFixed(2)} sec`);

      await search(1);

    } catch (err) {
      logLine(`❌ <span class="text-rose-600">${err.message}</span>`);
    } finally {
      setImportState(false);
    }
  }
};


search(1);
