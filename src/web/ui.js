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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/** 进度条：目标百分比（由轮询更新），显示值用 rAF 平滑逼近 */
let targetProgressPct = 0;
let displayedProgressPct = 0;
let progressAnim = null;
let jobAnimActive = false;

function setProgressBar(pct) {
  const el = $("progressFill");
  if (!el) return;
  el.style.width = `${clamp(Number(pct) || 0, 0, 100).toFixed(2)}%`;
}

function setTargetProgress(pct) {
  targetProgressPct = clamp(Number(pct) || 0, 0, 100);
}

function tickProgressAnim() {
  const diff = targetProgressPct - displayedProgressPct;
  if (Math.abs(diff) < 0.08) displayedProgressPct = targetProgressPct;
  else displayedProgressPct += diff * 0.22;
  setProgressBar(displayedProgressPct);
  if (jobAnimActive && Math.abs(targetProgressPct - displayedProgressPct) > 0.01) {
    progressAnim = requestAnimationFrame(tickProgressAnim);
  } else {
    progressAnim = null;
  }
}

function startProgressAnim() {
  jobAnimActive = true;
  if (!progressAnim) progressAnim = requestAnimationFrame(tickProgressAnim);
}

function stopProgressAnim() {
  jobAnimActive = false;
  if (progressAnim) cancelAnimationFrame(progressAnim);
  progressAnim = null;
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

function readCfgJson() {
  const obj = readJsonFromTextarea("configJson");
  return obj && typeof obj === "object" ? obj : null;
}

function ensureObjPath(root, pathArr) {
  let cur = root;
  for (const k of pathArr) {
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  return cur;
}

function setTplStatus(s) {
  setText("tplStatus", s || "");
}

function loadTplFormFromConfig(cfg) {
  const tpl = cfg?.nodeTemplate || {};
  $("tpl_type").value = tpl.type || "trojan";
  $("tpl_password").value = tpl.password || "";
  $("tpl_sni").value = tpl.sni || "";
  $("tpl_skipCertVerify").checked = Boolean(tpl.skipCertVerify);
  $("tpl_network").value = tpl.network || "ws";
  $("tpl_ws_path").value = tpl.ws?.path || "";
  $("tpl_ws_host").value = tpl.ws?.headers?.Host || tpl.ws?.headers?.host || "";
  $("tpl_ech_enable").checked = Boolean(tpl.ech?.enable);
  $("tpl_ech_query").value = tpl.ech?.queryServerName || "cloudflare-ech.com";
}

function applyTplFormToConfig(cfg) {
  const tpl = ensureObjPath(cfg, ["nodeTemplate"]);
  tpl.type = String($("tpl_type").value || "trojan").trim() || "trojan";
  tpl.password = String($("tpl_password").value || "").trim();
  tpl.sni = String($("tpl_sni").value || "").trim();
  tpl.skipCertVerify = Boolean($("tpl_skipCertVerify").checked);
  tpl.network = String($("tpl_network").value || "ws").trim() || "ws";

  tpl.ws = tpl.ws && typeof tpl.ws === "object" ? tpl.ws : {};
  tpl.ws.path = String($("tpl_ws_path").value || "").trim() || "/";
  tpl.ws.headers = tpl.ws.headers && typeof tpl.ws.headers === "object" ? tpl.ws.headers : {};
  const host = String($("tpl_ws_host").value || "").trim();
  if (host) tpl.ws.headers.Host = host;
  else delete tpl.ws.headers.Host;

  tpl.ech = tpl.ech && typeof tpl.ech === "object" ? tpl.ech : {};
  tpl.ech.enable = Boolean($("tpl_ech_enable").checked);
  tpl.ech.queryServerName = String($("tpl_ech_query").value || "cloudflare-ech.com").trim() || "cloudflare-ech.com";
}

function loadGeoCustomFromConfig(cfg) {
  const arr = Array.isArray(cfg?.geoApi?.customBaseUrls) ? cfg.geoApi.customBaseUrls : [];
  $("geoCustomApis").value = arr.filter(Boolean).join("\n");
}

function applyGeoCustomToConfig(cfg) {
  const geo = ensureObjPath(cfg, ["geoApi"]);
  const lines = String($("geoCustomApis").value || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  geo.customBaseUrls = lines;
}

let currentJobId = null;
let pollTimer = null;

async function loadConfig() {
  setText("cfgStatus", "加载中...");
  const r = await api("GET", "/api/config");
  $("configJson").value = JSON.stringify(r.config, null, 2);
  setText("cfgStatus", `已加载：${r.path}`);

  const cfg = r.config || {};
  const t = cfg.test || {};
  if (t.maxConcurrency != null) $("maxConcurrency").value = t.maxConcurrency;
  if (t.retries != null) $("retries").value = t.retries;
  if (t.retryBackoffMs != null) $("retryBackoffMs").value = t.retryBackoffMs;
  if (t.timeoutMs != null) $("timeoutMs").value = t.timeoutMs;

  try {
    loadTplFormFromConfig(cfg);
    loadGeoCustomFromConfig(cfg);
    setTplStatus("已从 JSON 同步到表单");
  } catch {
    setTplStatus("表单同步失败（请检查 config.json 结构）");
  }
}

async function saveConfig() {
  const obj = readCfgJson();
  if (!obj) {
    setText("cfgStatus", "JSON 格式错误，无法保存");
    return;
  }
  applyGeoCustomToConfig(obj);
  $("configJson").value = JSON.stringify(obj, null, 2);
  setText("cfgStatus", "保存中...");
  await api("PUT", "/api/config", obj);
  setText("cfgStatus", "保存成功");
}

async function loadOutputHistory() {
  const r = await api("GET", "/api/output");
  $("outputHistory").value = r.text || "";
  redrawMapFromOutputText(r.text || "");
}

async function saveOutputHistory() {
  const text = $("outputHistory").value || "";
  await api("PUT", "/api/output", { text });
  await loadOutputHistory();
}

function applyTplToJsonTextarea() {
  const cfg = readCfgJson();
  if (!cfg) {
    setTplStatus("JSON 格式错误：请先修复上方 config.json");
    return;
  }
  applyTplFormToConfig(cfg);
  $("configJson").value = JSON.stringify(cfg, null, 2);
  setTplStatus("已应用到 JSON（记得点“保存配置”写入文件）");
}

function loadTplFromJsonTextarea() {
  const cfg = readCfgJson();
  if (!cfg) {
    setTplStatus("JSON 格式错误：请先修复上方 config.json");
    return;
  }
  loadTplFormFromConfig(cfg);
  loadGeoCustomFromConfig(cfg);
  setTplStatus("已从 JSON 读取到表单");
}

function geoUrlsToJsonOnly() {
  const cfg = readCfgJson();
  if (!cfg) {
    setText("cfgStatus", "JSON 格式错误");
    return;
  }
  applyGeoCustomToConfig(cfg);
  $("configJson").value = JSON.stringify(cfg, null, 2);
  setText("cfgStatus", "自定义测地区 API 已写入 JSON（可再点保存配置落盘）");
}

function geoUrlsFromJsonOnly() {
  const cfg = readCfgJson();
  if (!cfg) {
    setText("cfgStatus", "JSON 格式错误");
    return;
  }
  loadGeoCustomFromConfig(cfg);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function parseResultLine(line) {
  const m = String(line).match(/^(\d+\.\d+\.\d+\.\d+:\d+)#(.+)\s+(.+?)中转\s+(.+)$/);
  if (!m) return null;
  const exitAndSeq = m[2].trim();
  const m2 = exitAndSeq.match(/^(.*?)(\d+)$/);
  const exitLabel = m2 ? m2[1].trim() : exitAndSeq;
  const transitCity = m[3].trim();
  return { ipPort: m[1], exitLabel, transitCity };
}

const LOC_HINTS = [
  [/香港|九龙|Kowloon/i, [114.17, 22.32]],
  [/厦门|Xiamen/i, [118.09, 24.48]],
  [/杭州|Hangzhou/i, [120.15, 30.28]],
  [/上海|Shanghai/i, [121.47, 31.23]],
  [/北京|Beijing/i, [116.4, 39.9]],
  [/深圳|Shenzhen/i, [114.06, 22.54]],
  [/广州|Guangzhou/i, [113.26, 23.13]],
  [/伦敦|London/i, [-0.12, 51.5]],
  [/加州|圣何西|圣荷西|聖荷西|San Jose|Silicon/i, [-121.89, 37.34]],
  [/纽约|New York/i, [-74.0, 40.71]],
  [/意大利|伦巴第|Lombardy|Gallarate|加拉拉泰|Milan|米兰/i, [9.19, 45.46]],
  [/德国|Frankfurt|法兰克福/i, [8.68, 50.11]],
  [/法国|Paris|巴黎/i, [2.35, 48.86]],
  [/新加坡|Singapore/i, [103.82, 1.35]],
  [/日本|东京|Tokyo/i, [139.69, 35.68]],
  [/韩国|首尔|Seoul/i, [126.98, 37.57]],
  [/澳大利亚|悉尼|Sydney/i, [151.2, -33.87]],
  [/美国(?!加州)/i, [-98.35, 39.5]],
  [/中国|China(?!香港)/i, [104.2, 35.86]],
  [/加拿大|Toronto|温哥华|Vancouver/i, [-79.38, 43.65]]
];

function guessLonLat(label) {
  if (!label) return null;
  for (const [re, ll] of LOC_HINTS) {
    if (re.test(label)) return ll;
  }
  return null;
}

function llToSvgXY(lon, lat) {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return [x, y];
}

const MAP_EQUIRECT_URL =
  "https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg";

function redrawMapFromOutputText(text) {
  const svg = $("worldMapSvg");
  const legend = $("mapLegend");
  if (!svg) return;
  if (legend) legend.textContent = "";
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const ns = "http://www.w3.org/2000/svg";

  const defs = document.createElementNS(ns, "defs");
  svg.appendChild(defs);

  const bg = document.createElementNS(ns, "image");
  bg.setAttribute("width", "1000");
  bg.setAttribute("height", "500");
  bg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  bg.setAttribute("opacity", "0.92");
  bg.setAttribute("href", MAP_EQUIRECT_URL);
  bg.addEventListener("error", () => {
    bg.setAttribute("opacity", "0");
    if (legend) legend.textContent += " （底图加载失败：请检查网络或稍后点「刷新地图」）";
  });
  svg.appendChild(bg);

  const veil = document.createElementNS(ns, "rect");
  veil.setAttribute("width", "1000");
  veil.setAttribute("height", "500");
  veil.setAttribute("fill", "rgba(6,18,40,0.38)");
  svg.appendChild(veil);

  const grid = document.createElementNS(ns, "g");
  grid.setAttribute("opacity", "0.12");
  for (let lon = -150; lon <= 150; lon += 30) {
    const [x] = llToSvgXY(lon, 0);
    const l = document.createElementNS(ns, "line");
    l.setAttribute("x1", x);
    l.setAttribute("x2", x);
    l.setAttribute("y1", "0");
    l.setAttribute("y2", "500");
    l.setAttribute("stroke", "#fff");
    grid.appendChild(l);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = llToSvgXY(0, lat);
    const l = document.createElementNS(ns, "line");
    l.setAttribute("x1", "0");
    l.setAttribute("x2", "1000");
    l.setAttribute("y1", y);
    l.setAttribute("y2", y);
    l.setAttribute("stroke", "#fff");
    grid.appendChild(l);
  }
  svg.appendChild(grid);

  const lines = String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  let drawn = 0;
  const colors = ["#5ad8ff", "#ff9f7f", "#9fe6b8", "#e690d1", "#8378ea"];
  lines.forEach((line, i) => {
    const p = parseResultLine(line);
    if (!p) return;
    const a = guessLonLat(p.transitCity);
    const b = guessLonLat(p.exitLabel);
    if (!a || !b) return;
    let [x1, y1] = llToSvgXY(a[0], a[1]);
    let [x2, y2] = llToSvgXY(b[0], b[1]);
    if (Math.hypot(x2 - x1, y2 - y1) < 8) {
      x2 += 6;
      y2 -= 4;
    }
    const mx = (x1 + x2) / 2;
    const my = Math.min(y1, y2) - 70 - (i % 5) * 8;
    const path = document.createElementNS(ns, "path");
    const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", colors[i % colors.length]);
    path.setAttribute("stroke-width", "2.2");
    path.setAttribute("opacity", "0.92");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("class", "map-arc");
    svg.appendChild(path);

    function dot(x, y, fill) {
      const c = document.createElementNS(ns, "circle");
      c.setAttribute("cx", x);
      c.setAttribute("cy", y);
      c.setAttribute("r", "5");
      c.setAttribute("fill", fill);
      c.setAttribute("stroke", "rgba(255,255,255,.35)");
      c.setAttribute("stroke-width", "1");
      c.setAttribute("class", "map-dot");
      svg.appendChild(c);
    }
    dot(x1, y1, "#ffd666");
    dot(x2, y2, "#69f0ae");
    drawn += 1;
  });

  if (legend) {
    legend.textContent = `已解析 ${lines.length} 行，绘制 ${drawn} 条中转→落地弧线（黄点：中转，绿点：落地）。`;
  }
}

async function pollJob() {
  if (!currentJobId) return;
  const job = await api("GET", `/api/jobs/${currentJobId}`);

  setText("jobStatus", `任务 ${job.status} / stage=${job.stage}`);
  const p = job.progress || {};
  const stepName = p.stepName || "";
  const step = Number(p.step || 0);
  const stepsTotal = Number(p.totalSteps || 0) || 6;
  const done = Number(p.done || 0);
  const total = Number(p.total || 0);
  const detail = p.detail ? String(p.detail) : "";

  let pct = 0;
  if (step > 0) {
    const base = clamp((step - 1) / stepsTotal, 0, 1);
    const within = total > 0 ? clamp(done / total, 0, 1) : 0;
    pct = (base + within / stepsTotal) * 100;
  } else if (total > 0) {
    pct = clamp(done / total, 0, 1) * 100;
  }
  setTargetProgress(pct);
  startProgressAnim();

  const detailPart = detail ? ` ｜ ${detail}` : "";
  const countPart = total > 0 ? `（${done}/${total}）` : "";
  const stepLabel = stepName ? `步骤：${stepName}` : `stage=${job.stage}`;
  setText(
    "progressText",
    `${stepLabel}${countPart}  进度：${pct.toFixed(1)}%${detailPart}  更新时间：${job.updatedAt}`
  );
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
    stopProgressAnim();
    setProgressBar(targetProgressPct);
    displayedProgressPct = targetProgressPct;
    if (job.status === "error") {
      setText("summary", `错误：${job.error || "未知错误"}`);
    } else {
      loadOutputHistory().catch(() => {});
    }
  }
}

async function startJob() {
  stopPolling();
  stopProgressAnim();
  setText("results", "");
  setText("summary", "");
  setText("logs", "");
  setText("progressText", "");
  targetProgressPct = 0;
  displayedProgressPct = 0;
  setProgressBar(0);

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

  startProgressAnim();
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
$("btnApplyTplToJson").addEventListener("click", () => applyTplToJsonTextarea());
$("btnLoadTplFromJson").addEventListener("click", () => loadTplFromJsonTextarea());
$("btnGeoUrlsToJson").addEventListener("click", () => geoUrlsToJsonOnly());
$("btnGeoUrlsFromJson").addEventListener("click", () => geoUrlsFromJsonOnly());
$("btnLoadOutput").addEventListener("click", () => loadOutputHistory().catch((e) => setText("jobStatus", String(e))));
$("btnSaveOutput").addEventListener("click", () => saveOutputHistory().catch((e) => setText("jobStatus", String(e))));
$("btnRefreshMap").addEventListener("click", () => {
  try {
    redrawMapFromOutputText($("outputHistory").value || "");
  } catch (e) {
    setText("jobStatus", String(e));
  }
});

loadConfig()
  .then(() => loadOutputHistory())
  .catch(() => {});
