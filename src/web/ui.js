async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function $(id) {
  return document.getElementById(id);
}

function setText(id, s) {
  $(id).textContent = s == null ? "" : String(s);
}

function appendLog(s) {
  const el = $("logs");
  el.textContent = String(s || "");
}

function readJsonFromTextarea(id) {
  const raw = $(id).value;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

let currentJobId = null;
let pollTimer = null;

async function loadConfig() {
  setText("cfgStatus", "加载中...");
  const r = await api("GET", "/api/config");
  $("configJson").value = JSON.stringify(r.config, null, 2);
  setText("cfgStatus", `已加载：${r.path}`);

  // 同步默认值到覆盖输入框
  const cfg = r.config || {};
  const t = cfg.test || {};
  if (t.maxConcurrency != null) $("maxConcurrency").value = t.maxConcurrency;
  if (t.retries != null) $("retries").value = t.retries;
  if (t.retryBackoffMs != null) $("retryBackoffMs").value = t.retryBackoffMs;
  if (t.timeoutMs != null) $("timeoutMs").value = t.timeoutMs;
}

async function saveConfig() {
  const obj = readJsonFromTextarea("configJson");
  if (!obj) {
    setText("cfgStatus", "JSON 格式错误，无法保存");
    return;
  }
  setText("cfgStatus", "保存中...");
  await api("PUT", "/api/config", obj);
  setText("cfgStatus", "保存成功");
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function pollJob() {
  if (!currentJobId) return;
  const job = await api("GET", `/api/jobs/${currentJobId}`);

  setText("jobStatus", `任务 ${job.status} / stage=${job.stage}`);
  setText("progressText", `进度：${job.progress?.done || 0}/${job.progress?.total || 0}   更新时间：${job.updatedAt}`);
  appendLog((job.logs || []).join("\n"));

  if (job.result) {
    const lines = job.result.lines || [];
    setText("results", lines.join("\n"));
    const fs = job.result.failuresSummary || {};
    const totals = job.result.totals || {};
    setText("summary", `parsed=${totals.parsed || 0} tested=${totals.tested || 0} ok=${totals.ok || 0}  failures=${JSON.stringify(fs)}`);
  }

  if (job.status === "done" || job.status === "error") {
    stopPolling();
    if (job.status === "error") {
      setText("summary", `错误：${job.error || "未知错误"}`);
    }
  }
}

async function startJob() {
  stopPolling();
  setText("results", "");
  setText("summary", "");
  setText("logs", "");

  const fofaText = $("fofaText").value || "";
  if (!fofaText.trim()) {
    setText("jobStatus", "请先粘贴 FOFA 文本");
    return;
  }

  const testOverrides = {
    maxConcurrency: Number($("maxConcurrency").value),
    retries: Number($("retries").value),
    retryBackoffMs: Number($("retryBackoffMs").value),
    timeoutMs: Number($("timeoutMs").value)
  };

  const r = await api("POST", "/api/jobs", { fofaText, testOverrides });
  currentJobId = r.id;
  setText("jobStatus", `已创建任务：${currentJobId}`);

  await pollJob();
  pollTimer = setInterval(pollJob, 1000);
}

function copyResults() {
  const text = $("results").textContent || "";
  navigator.clipboard?.writeText(text);
}

function downloadResults() {
  const text = $("results").textContent || "";
  downloadText("results.txt", text);
}

async function runDiag() {
  setText("jobStatus", "诊断中...");
  const r = await api("GET", "/api/diag");
  setText("jobStatus", "诊断完成（见日志区）");
  const pretty = JSON.stringify(r, null, 2);
  appendLog(pretty);
}

$("btnLoadCfg").addEventListener("click", () => loadConfig().catch((e) => setText("cfgStatus", String(e))));
$("btnSaveCfg").addEventListener("click", () => saveConfig().catch((e) => setText("cfgStatus", String(e))));
$("btnStart").addEventListener("click", () => startJob().catch((e) => setText("jobStatus", String(e))));
$("btnDiag").addEventListener("click", () => runDiag().catch((e) => setText("jobStatus", String(e))));
$("btnCopy").addEventListener("click", () => copyResults());
$("btnDownload").addEventListener("click", () => downloadResults());

loadConfig().catch(() => {});

