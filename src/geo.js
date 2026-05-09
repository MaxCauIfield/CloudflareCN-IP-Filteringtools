const { sleep } = require("./sleep");

const DEFAULT_BUILTIN_GEO_BASES = [
  "https://ip-api.com/json",
  "http://ipwhois.app/json",
  "https://api.ipapi.is"
];

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

/** ASN：仅使用 API 的 as/org 原文解析，不做繁简、不做翻译（与 ip-api 的 as 字段语义一致）。 */
function asnFromIpApiAsField(asRaw) {
  const s = String(asRaw || "").trim();
  if (!s) return "未知ASN";
  return s.replace(/^AS\d+\s+/i, "").trim() || s;
}

function normalizeIpApiResult(obj) {
  if (!obj || obj.status !== "success") return null;
  return {
    ip: obj.query,
    country: obj.country,
    regionName: obj.regionName,
    district: obj.district != null ? String(obj.district) : "",
    city: obj.city,
    asnFull: asnFromIpApiAsField(obj.as)
  };
}

function normalizeOtherGeoResult(baseUrl, ip, obj) {
  const u = String(baseUrl || "").toLowerCase();
  if (u.includes("ipwho.is")) {
    if (!obj || obj.success === false) return null;
    const asnFull = (obj.connection?.org || "").trim() || (obj.connection?.asn ? `AS${obj.connection.asn}` : "");
    return {
      ip,
      country: obj.country,
      regionName: obj.region,
      district: "",
      city: obj.city,
      asnFull: asnFull || "未知ASN"
    };
  }
  if (u.includes("ipapi.co")) {
    if (!obj || obj.error) return null;
    return {
      ip,
      country: obj.country_name,
      regionName: obj.region,
      district: "",
      city: obj.city,
      asnFull: (obj.org || "").trim() || "未知ASN"
    };
  }
  if (u.includes("ipwhois.app")) {
    if (!obj || obj.success === false) return null;
    const asnFull = (obj.org || obj.isp || "").trim();
    return {
      ip,
      country: obj.country,
      regionName: obj.region,
      district: "",
      city: obj.city,
      asnFull: asnFull || "未知ASN"
    };
  }
  if (u.includes("ipapi.is")) {
    if (!obj || typeof obj !== "object") return null;
    const loc = obj.location && typeof obj.location === "object" ? obj.location : obj;
    const country = loc.country || obj.country_name || obj.country;
    const regionName = loc.region || loc.state || obj.region || obj.state;
    const city = loc.city || obj.city;
    let asnFull = "";
    if (obj.asn && typeof obj.asn === "object") {
      asnFull = String(obj.asn.name || obj.asn.organization || obj.asn.org || "").trim();
    } else if (typeof obj.asn === "string") {
      asnFull = obj.asn.trim();
    }
    asnFull = asnFull || String(obj.org || obj.isp || obj.company?.name || "").trim();
    if (!country && !regionName && !city) return null;
    return {
      ip,
      country,
      regionName,
      district: "",
      city,
      asnFull: asnFull || "未知ASN"
    };
  }
  return null;
}

function buildGeoBaseUrlList(cfg) {
  const custom = Array.isArray(cfg.geoApi?.customBaseUrls) ? cfg.geoApi.customBaseUrls : [];
  const fallback = Array.isArray(cfg.geoApi?.fallbackBaseUrls) ? cfg.geoApi.fallbackBaseUrls : [];
  const builtin =
    Array.isArray(cfg.geoApi?.builtinFallbackBaseUrls) && cfg.geoApi.builtinFallbackBaseUrls.length
      ? cfg.geoApi.builtinFallbackBaseUrls
      : DEFAULT_BUILTIN_GEO_BASES;
  const primary = cfg.geoApi?.baseUrl ? [cfg.geoApi.baseUrl] : [];
  const raw = [...custom.map((s) => String(s).trim()).filter(Boolean), ...primary, ...fallback, ...builtin]
    .map((s) => String(s).trim())
    .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const u of raw) {
    const k = u.replace(/\/+$/, "");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function normBaseKey(u) {
  return String(u || "")
    .trim()
    .replace(/\/+$/, "");
}

/** 节点查询：自定义 API 之后，优先 ip-api（便于 ASN 与 ip-api 的 as 字段一致），再其它源。 */
function orderBasesForNode(all, cfg) {
  const custom = Array.isArray(cfg.geoApi?.customBaseUrls)
    ? cfg.geoApi.customBaseUrls.map((s) => normBaseKey(s)).filter(Boolean)
    : [];
  const customKeys = new Set(custom);
  const cust = all.filter((u) => customKeys.has(normBaseKey(u)));
  const non = all.filter((u) => !cust.includes(u));
  const ipApi = non.filter((b) => b.includes("ip-api.com"));
  const rest = non.filter((b) => !b.includes("ip-api.com"));
  return [...cust, ...ipApi, ...rest];
}

/** 出口查询：优先 ip-api（字段较全），再走其它源并允许合并补全 region。 */
function orderBasesForExit(all, cfg) {
  const custom = Array.isArray(cfg.geoApi?.customBaseUrls)
    ? cfg.geoApi.customBaseUrls.map((s) => normBaseKey(s)).filter(Boolean)
    : [];
  const customKeys = new Set(custom);
  const cust = all.filter((u) => customKeys.has(normBaseKey(u)));
  const non = all.filter((u) => !cust.includes(u));
  const ipApi = non.filter((b) => b.includes("ip-api.com"));
  const rest = non.filter((b) => !b.includes("ip-api.com"));
  return [...cust, ...ipApi, ...rest];
}

async function fetchMetaForBase(cfg, ip, baseRaw) {
  const timeoutMs = cfg.geoApi.timeoutMs;
  const baseUrl = String(baseRaw).replace(/\/+$/, "");
  try {
    if (baseUrl.includes("ip-api.com")) {
      const fields = encodeURIComponent(cfg.geoApi.fields);
      const lang = cfg.geoApi.lang ? encodeURIComponent(String(cfg.geoApi.lang)) : "";
      const url = `${baseUrl}/${encodeURIComponent(ip)}?fields=${fields}${lang ? `&lang=${lang}` : ""}`;
      const obj = await fetchJsonWithTimeout(url, timeoutMs);
      return normalizeIpApiResult(obj);
    }
    if (baseUrl.includes("ipwho.is")) {
      const lang = cfg.geoApi.lang ? encodeURIComponent(String(cfg.geoApi.lang).split("-")[0]) : "";
      const url = `${baseUrl}/${encodeURIComponent(ip)}${lang ? `?lang=${lang}` : ""}`;
      const obj = await fetchJsonWithTimeout(url, timeoutMs);
      return normalizeOtherGeoResult(baseUrl, ip, obj);
    }
    if (baseUrl.includes("ipapi.co")) {
      const url = `${baseUrl}/${encodeURIComponent(ip)}/json/`;
      const obj = await fetchJsonWithTimeout(url, timeoutMs);
      return normalizeOtherGeoResult(baseUrl, ip, obj);
    }
    if (baseUrl.includes("ipwhois.app")) {
      const url = `http://ipwhois.app/json/${encodeURIComponent(ip)}`;
      const obj = await fetchJsonWithTimeout(url, timeoutMs);
      return normalizeOtherGeoResult("http://ipwhois.app/json", ip, obj);
    }
    if (baseUrl.includes("ipapi.is")) {
      const url = `https://api.ipapi.is/?q=${encodeURIComponent(ip)}`;
      const obj = await fetchJsonWithTimeout(url, timeoutMs);
      return normalizeOtherGeoResult("https://api.ipapi.is", ip, obj);
    }
  } catch {
    return null;
  }
  return null;
}

function needsRegionSupplement(meta) {
  if (!meta) return false;
  if (String(meta.regionName || "").trim()) return false;
  const co = `${meta.country || ""}`.toLowerCase();
  return (
    /hong kong|hongkong|香港/.test(co) ||
    /united states|u\.s\.|usa\b/.test(co) ||
    /italy|italia|意大利/.test(co)
  );
}

/**
 * 出口落地 IP：先按固定顺序取首个成功；若缺省/州再尝试其它源合并 region（不覆盖已有 ASN，出口也不用 ASN）。
 */
async function geoLookupExitMerged(cfg, ip) {
  const all = buildGeoBaseUrlList(cfg);
  const ordered = orderBasesForExit(all, cfg);
  let meta = null;
  let usedKey = "";
  for (const b of ordered) {
    const m = await fetchMetaForBase(cfg, ip, b);
    if (m) {
      meta = m;
      usedKey = normBaseKey(b);
      break;
    }
  }
  if (!meta) return null;
  if (!needsRegionSupplement(meta)) return meta;
  const gap = Math.max(0, Number(cfg.geoApi?.minIntervalMs || 0));
  if (gap > 0) await sleep(Math.min(gap, 800));
  for (const b of ordered) {
    if (normBaseKey(b) === usedKey) continue;
    const m2 = await fetchMetaForBase(cfg, ip, b);
    if (!m2) continue;
    const r2 = String(m2.regionName || "").trim();
    if (r2) {
      meta = { ...meta, regionName: m2.regionName };
      break;
    }
  }
  return meta;
}

async function geoLookupOneNode(cfg, ip) {
  const all = buildGeoBaseUrlList(cfg);
  const ordered = orderBasesForNode(all, cfg);
  for (const b of ordered) {
    const m = await fetchMetaForBase(cfg, ip, b);
    if (m) return m;
  }
  return null;
}

function previewMeta(meta) {
  if (!meta) return "";
  const a = [meta.city, meta.regionName, meta.country].filter(Boolean);
  return a.join(" / ");
}

/**
 * 分批查询 ip 列表，内置最小间隔控制，返回 Map<ip, meta>
 */
async function geoLookupBatch(cfg, ips, hooks = {}) {
  const onProgress = typeof hooks.onProgress === "function" ? hooks.onProgress : () => {};
  const uniq = Array.from(new Set(ips.filter(Boolean)));
  const out = new Map();

  const minIntervalMs = Math.max(0, Number(cfg.geoApi.minIntervalMs || 0));
  let lastTs = 0;

  let idx = 0;
  for (const ip of uniq) {
    idx += 1;
    onProgress({ ip, index: idx, total: uniq.length, phase: hooks.phase || "geo" });

    const now = Date.now();
    const wait = lastTs ? Math.max(0, minIntervalMs - (now - lastTs)) : 0;
    if (wait > 0) await sleep(wait);

    lastTs = Date.now();
    try {
      const meta = await geoLookupOneNode(cfg, ip);
      if (meta) {
        out.set(ip, meta);
        onProgress({
          ip,
          index: idx,
          total: uniq.length,
          phase: hooks.phase || "geo",
          preview: previewMeta(meta)
        });
      } else {
        onProgress({ ip, index: idx, total: uniq.length, phase: hooks.phase || "geo", preview: "(无结果)" });
      }
    } catch {
      onProgress({ ip, index: idx, total: uniq.length, phase: hooks.phase || "geo", preview: "(失败)" });
    }
  }

  return out;
}

module.exports = { geoLookupBatch, geoLookupExitMerged, buildGeoBaseUrlList };
