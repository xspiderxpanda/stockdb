// Search page logic (Electron renderer)
// Uses API base from preload: window.env.API_BASE_URL
// Endpoints (override by setting window.env.ENDPOINTS in preload if needed)

const keywordInput = document.getElementById("keywordInput");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");

const resultBody = document.getElementById("resultBody");
const showingCount = document.getElementById("showingCount");
const resultMeta = document.getElementById("resultMeta");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");

const bucketType = document.getElementById("bucketType");
const bucketKey = document.getElementById("bucketKey");
const bucketHint = document.getElementById("bucketHint");

let currentPage = 1;
const limit = 10;

// ---------- config ----------
function apiBase() {
  const base = window.env?.API_BASE_URL;
  return base ? base.replace(/\/$/, "") : null;
}
function ep(name, fallback) {
  return window.env?.ENDPOINTS?.[name] || fallback;
}
const ENDPOINTS = {
  SEARCH: ep("SEARCH", "/api/search_product_service/search"),
  BUCKET: ep("BUCKET", "/api/search_product_service/bucket"),
};

// ---------- helpers ----------
function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function setLoadingTable() {
  resultBody.innerHTML = `
    <tr><td colspan="6" class="py-10 text-center text-slate-400">กำลังค้นหา...</td></tr>
  `;
}

function setEmptyTable(msg = "ไม่พบข้อมูล") {
  resultBody.innerHTML = `
    <tr><td colspan="6" class="py-10 text-center text-slate-400">${msg}</td></tr>
  `;
}

async function safeJson(res) {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`API ไม่ได้ส่ง JSON (status ${res.status}): ${raw.slice(0, 200)}`);
  }
}

function fmtPrice(v) {
  if (v === undefined || v === null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString();
}

function createUnitSelect(skus, onChange) {
  const select = document.createElement("select");
  select.className = "unit-select rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm";

  skus.forEach((s, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = `${s.unit}`;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    const selected = skus[Number(select.value)];
    onChange(selected);
  });

  return select;
}

function addRow(tbody, product) {
  if (!product?.skus?.length) return;

  const tr = document.createElement("tr");
  let currentSku = product.skus[0];

  // SKU
  const tdSku = document.createElement("td");
  tdSku.className = "px-4 py-3 font-mono text-xs text-slate-700";
  tdSku.textContent = currentSku.sku ?? "-";
  tr.appendChild(tdSku);

  // Product
  const tdName = document.createElement("td");
  tdName.className = "px-4 py-3";
  tdName.textContent = product.product_name ?? "-";
  tr.appendChild(tdName);

  // Unit (select)
  const tdUnit = document.createElement("td");
  tdUnit.className = "px-4 py-3";
  const unitSelect = createUnitSelect(product.skus, (selected) => {
    currentSku = selected;
    factorSpan.textContent = selected.factor ?? "-";
    priceSpan.textContent = fmtPrice(selected.price);
    stockSpan.textContent = selected.stock_qty ?? "-";
    tdSku.textContent = selected.sku ?? "-";
  });
  tdUnit.appendChild(unitSelect);
  tr.appendChild(tdUnit);

  // Factor
  const tdFactor = document.createElement("td");
  tdFactor.className = "px-4 py-3";
  const factorSpan = document.createElement("span");
  factorSpan.textContent = currentSku.factor ?? "-";
  tdFactor.appendChild(factorSpan);
  tr.appendChild(tdFactor);

  // Price
  const tdPrice = document.createElement("td");
  tdPrice.className = "px-4 py-3 text-right";
  const priceSpan = document.createElement("span");
  priceSpan.textContent = fmtPrice(currentSku.price);
  tdPrice.appendChild(priceSpan);
  tr.appendChild(tdPrice);

  // Stock
  const tdStock = document.createElement("td");
  tdStock.className = "px-4 py-3 text-right";
  const stockSpan = document.createElement("span");
  stockSpan.textContent = currentSku.stock_qty ?? "-";
  tdStock.appendChild(stockSpan);
  tr.appendChild(tdStock);

  tbody.appendChild(tr);
}

// ---------- BUCKET ----------
async function loadBuckets() {
  const base = apiBase();
  if (!base) return;

  const type = bucketType.value;
  bucketKey.innerHTML = "";
  bucketHint.textContent = "";

  if (!type) {
    bucketKey.disabled = true;
    bucketKey.innerHTML = `<option value="">เลือกทั้งหมด</option>`;
    return;
  }

  bucketKey.disabled = true;
  bucketKey.innerHTML = `<option value="">กำลังโหลด...</option>`;

  try {
    const url = new URL(base + ENDPOINTS.BUCKET);
    url.searchParams.set("type", type);

    const res = await fetch(url.toString());
    const data = await safeJson(res);

    if (!res.ok) throw new Error(data.message || "โหลด bucket ไม่สำเร็จ");

    bucketKey.innerHTML = `<option value="">ทั้งหมด</option>`;
    (data.buckets || []).forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.key;
      opt.textContent = `${b.key} (${b.count})`;
      bucketKey.appendChild(opt);
    });

    bucketKey.disabled = false;
    bucketHint.textContent =
      type === "unit"
        ? "กรองผลลัพธ์ตามหน่วยนับ (unit)"
        : "bucket ใช้ดูสถิติ (ถ้าจะกรองจริงให้ใช้ bucket=unit)";
  } catch (e) {
    bucketKey.disabled = true;
    bucketKey.innerHTML = `<option value="">โหลด bucket ไม่สำเร็จ</option>`;
    bucketHint.textContent = e.message || "โหลด bucket ไม่สำเร็จ";
  }
}

// ---------- SEARCH ----------
async function search(page = 1) {
  const base = apiBase();
  if (!base) {
    setEmptyTable("ยังไม่ได้ตั้งค่า API_BASE_URL (ดู preload.js)");
    return;
  }

  const keyword = keywordInput.value.trim();
  currentPage = page;

  setLoadingTable();
  showingCount.textContent = "0";
  resultMeta.textContent = "กำลังค้นหา...";

  // unit filter: ใช้เฉพาะตอน bucketType = unit
  const unit = bucketType.value === "unit" ? (bucketKey.value || "") : "";

  const t0 = performance.now();

  try {
    const url = new URL(base + ENDPOINTS.SEARCH);
    url.searchParams.set("keyword", keyword || "");
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    if (unit) url.searchParams.set("unit", unit);

    const res = await fetch(url.toString());
    const data = await safeJson(res);
    const tookMs = Math.round(performance.now() - t0);

    if (!res.ok) throw new Error(data.message || "ค้นหาไม่สำเร็จ");

    resultBody.innerHTML = "";
    let rows = 0;

    (data.items || []).forEach((p) => {
      addRow(resultBody, p);
      rows++;
    });

    if (rows === 0) setEmptyTable("ไม่พบข้อมูล");

    showingCount.textContent = String(rows);
    pageInfo.textContent = `Page ${data.page ?? 1} / ${data.totalPages ?? 1}`;
    prevBtn.disabled = (data.page ?? 1) <= 1;
    nextBtn.disabled = (data.page ?? 1) >= (data.totalPages ?? 1);
    resultMeta.textContent = `${data.total ?? rows} รายการ • ${tookMs} ms`;
  } catch (e) {
    console.error(e);
    setEmptyTable(`ค้นหาไม่สำเร็จ: ${e.message || e}`);
    resultMeta.textContent = "เกิดข้อผิดพลาด";
    pageInfo.textContent = "Page 0 / 0";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  }
}

// events
const debouncedSearch = debounce(() => search(1), 300);
keywordInput.addEventListener("input", debouncedSearch);

searchBtn.onclick = () => search(1);
prevBtn.onclick = () => search(Math.max(1, currentPage - 1));
nextBtn.onclick = () => search(currentPage + 1);

clearBtn.onclick = () => {
  keywordInput.value = "";
  search(1);
  setEmptyTable("เริ่มต้นด้วยการค้นหาสินค้า");
  showingCount.textContent = "0";
  pageInfo.textContent = "Page 0 / 0";
  resultMeta.textContent = "พร้อมค้นหา";
};

bucketType.addEventListener("change", async () => {
  await loadBuckets();
  await search(1);
});
bucketKey.addEventListener("change", () => search(1));

// init
loadBuckets().finally(() => search(1));
