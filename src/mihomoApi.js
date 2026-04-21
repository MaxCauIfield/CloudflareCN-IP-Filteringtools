const { controllerBase, authHeaders } = require("./mihomo");

async function fetchJsonWithTimeout(url, { method = "GET", headers = {}, body, timeoutMs = 8000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error("timeout")), timeoutMs);
  try {
    const res = await fetch(url, { method, headers, body, signal: ac.signal });
    const text = await res.text().catch(() => "");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(t);
  }
}

async function mihomoDelayTest(cfg, proxyName) {
  const base = controllerBase(cfg);
  const url = new URL(`${base}/proxies/${encodeURIComponent(proxyName)}/delay`);
  url.searchParams.set("timeout", String(cfg.test.timeoutMs));
  url.searchParams.set("url", cfg.test.delayTestUrl);

  const httpTimeout = Math.max(1000, Number(cfg.test.timeoutMs || 7000) + 2000);
  const r = await fetchJsonWithTimeout(url.toString(), {
    headers: authHeaders(cfg),
    timeoutMs: httpTimeout
  });
  if (!r.ok) return null;
  const delay = r.json && typeof r.json.delay === "number" ? r.json.delay : null;
  return delay;
}

async function mihomoSelectGlobal(cfg, proxyName) {
  const base = controllerBase(cfg);
  const url = `${base}/proxies/GLOBAL`;
  const r = await fetchJsonWithTimeout(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(cfg)
    },
    body: JSON.stringify({ name: proxyName }),
    timeoutMs: 8000
  });
  if (!r.ok) throw new Error(`切换 GLOBAL 失败：HTTP ${r.status}`);
}

module.exports = { mihomoDelayTest, mihomoSelectGlobal };

