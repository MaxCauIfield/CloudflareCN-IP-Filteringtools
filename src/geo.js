const { sleep } = require("./sleep");

async function fetchJsonWithTimeout(url, timeoutMs) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error("timeout")), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function normalizeIpApiResult(obj) {
  if (!obj || obj.status !== "success") return null;
  const asRaw = String(obj.as || "");
  // ip-api 的 as 字段通常形如 "AS45102 Alibaba (China) Technology Co., Ltd."
  // 这里尽量提取“机构全称”，保留原串也行。
  const asnFull = asRaw.replace(/^AS\d+\s*/i, "").trim() || asRaw.trim();
  return {
    ip: obj.query,
    country: obj.country,
    regionName: obj.regionName,
    city: obj.city,
    asnFull
  };
}

function normalizeOtherGeoResult(baseUrl, ip, obj) {
  const u = String(baseUrl || "").toLowerCase();
  // ipwho.is: { success, country, region, city, connection: { asn, org } }
  if (u.includes("ipwho.is")) {
    if (!obj || obj.success === false) return null;
    const asnFull = (obj.connection?.org || "").trim() || (obj.connection?.asn ? `AS${obj.connection.asn}` : "");
    return {
      ip,
      country: obj.country,
      regionName: obj.region,
      city: obj.city,
      asnFull: asnFull || "未知ASN"
    };
  }
  // ipapi.co/{ip}/json: { country_name, region, city, org }
  if (u.includes("ipapi.co")) {
    if (!obj || obj.error) return null;
    return {
      ip,
      country: obj.country_name,
      regionName: obj.region,
      city: obj.city,
      asnFull: (obj.org || "").trim() || "未知ASN"
    };
  }
  return null;
}

async function geoLookupOne(cfg, ip) {
  const timeoutMs = cfg.geoApi.timeoutMs;
  const baseUrls = [
    cfg.geoApi.baseUrl,
    ...(Array.isArray(cfg.geoApi.fallbackBaseUrls) ? cfg.geoApi.fallbackBaseUrls : [])
  ].filter(Boolean);

  let lastErr = null;
  for (const base of baseUrls) {
    const baseUrl = String(base).replace(/\/+$/, "");
    try {
      // ip-api.com 兼容模式
      if (baseUrl.includes("ip-api.com")) {
        const fields = encodeURIComponent(cfg.geoApi.fields);
        const lang = cfg.geoApi.lang ? encodeURIComponent(String(cfg.geoApi.lang)) : "";
        const url = `${baseUrl}/${encodeURIComponent(ip)}?fields=${fields}${lang ? `&lang=${lang}` : ""}`;
        const obj = await fetchJsonWithTimeout(url, timeoutMs);
        const r = normalizeIpApiResult(obj);
        if (r) return r;
      } else if (baseUrl.includes("ipwho.is")) {
        const lang = cfg.geoApi.lang ? encodeURIComponent(String(cfg.geoApi.lang).split("-")[0]) : "";
        const url = `${baseUrl}/${encodeURIComponent(ip)}${lang ? `?lang=${lang}` : ""}`;
        const obj = await fetchJsonWithTimeout(url, timeoutMs);
        const r = normalizeOtherGeoResult(baseUrl, ip, obj);
        if (r) return r;
      } else if (baseUrl.includes("ipapi.co")) {
        const url = `${baseUrl}/${encodeURIComponent(ip)}/json/`;
        const obj = await fetchJsonWithTimeout(url, timeoutMs);
        const r = normalizeOtherGeoResult(baseUrl, ip, obj);
        if (r) return r;
      } else {
        // unknown base
      }
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  if (lastErr) throw lastErr;
  return null;
}

/**
 * 分批查询 ip 列表，内置最小间隔控制，返回 Map<ip, meta>
 */
async function geoLookupBatch(cfg, ips) {
  const uniq = Array.from(new Set(ips.filter(Boolean)));
  const out = new Map();

  const minIntervalMs = Math.max(0, Number(cfg.geoApi.minIntervalMs || 0));
  let lastTs = 0;

  for (const ip of uniq) {
    const now = Date.now();
    const wait = lastTs ? Math.max(0, minIntervalMs - (now - lastTs)) : 0;
    if (wait > 0) await sleep(wait);

    lastTs = Date.now();
    try {
      const meta = await geoLookupOne(cfg, ip);
      if (meta) out.set(ip, meta);
    } catch {
      // 忽略单点失败，让后续流程继续
    }
  }

  return out;
}

module.exports = { geoLookupBatch };

