const logBody = document.getElementById("logBody");
const logMeta = document.getElementById("logMeta");
const fnFilter = document.getElementById("fnFilter");
const reloadBtn = document.getElementById("reloadBtn");
const prevLog = document.getElementById("prevLog");
const nextLog = document.getElementById("nextLog");
const logPageInfo = document.getElementById("logPageInfo");

let page = 1;
const limit = 20;

function fmt(t) {
  return t ? new Date(t).toLocaleString() : "-";
}

function row(log) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="px-4 py-3">${fmt(log.created_at || log.start_time)}</td>
    <td class="px-4 py-3 font-mono text-xs">${log.function_name || "-"}</td>
    <td class="px-4 py-3 text-xs">${log.function_endpoint || "-"}</td>
    <td class="px-4 py-3 text-right">${log.duration_ms ?? "-"}</td>
    <td class="px-4 py-3 text-right">${log.count_data ?? "-"}</td>
    <td class="px-4 py-3 text-right">${log.status_code ?? "-"}</td>
  `;
  return tr;
}

async function load(p = 1) {
  page = p;
  logBody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">กำลังโหลด...</td></tr>`;

  const fn = fnFilter.value.trim();
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (fn) qs.set("function_name", fn);

  const res = await fetch(`${window.env.API_BASE_URL}/api/transaction_logs?` + qs.toString());
  const data = await res.json();

  if (!res.ok) {
    logBody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-rose-600">${data.message || "โหลดไม่สำเร็จ"}</td></tr>`;
    return;
  }

  logBody.innerHTML = "";
  data.items.forEach((x) => logBody.appendChild(row(x)));

  logPageInfo.textContent = `Page ${data.page} / ${data.totalPages}`;
  prevLog.disabled = data.page <= 1;
  nextLog.disabled = data.page >= data.totalPages;
  logMeta.textContent = `${data.total} records`;
}

reloadBtn.onclick = () => load(1);
fnFilter.onchange = () => load(1);
prevLog.onclick = () => load(page - 1);
nextLog.onclick = () => load(page + 1);

load(1);
