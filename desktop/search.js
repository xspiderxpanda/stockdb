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


function addRow(product, sku = {}) {
  const tr = document.createElement("tr");
  tr.className = "hover:bg-slate-50";
  tr.innerHTML = `
    <td class="px-4 py-3">${sku.sku ?? "-"}</td>
    <td class="px-4 py-3">${product.product_name ?? "-"}</td>
    <td class="px-4 py-3">${sku.unit ?? "-"}</td>
    <td class="px-4 py-3 text-right">${fmtPrice(sku.price)}</td>
    <td class="px-4 py-3 text-right">${sku.stock_qty ?? "-"}</td>
  `;
  resultBody.appendChild(tr);
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
    if (!p.skus || p.skus.length === 0) {
      addRow(p);
      rows++;
    } else {
      p.skus.forEach((s) => {
        addRow(p, s);
        rows++;
      });
    }
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
  addMsg.innerHTML = "";
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

      const data = await res.json();
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
      logLine(`Start : ${fmtTime(data.timing?.startAt)}`);
      logLine(`End : ${fmtTime(data.timing?.endAt)}`);
      logLine(`Processing time : ${data.timing?.durationSec} sec`);
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
