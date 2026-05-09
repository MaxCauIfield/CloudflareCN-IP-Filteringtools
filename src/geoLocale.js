/**
 * 将国家/省州/城市等字段格式化为展示用简体中文地名串（ASN 不在此处理）。
 */

const { translateEnglishCountryPhrases } = require("./geoCountryZh");

// 常见英文/拉丁地名 → 简体中文（无法命中时保留原文）。键名一律小写，按长度长优先替换。
const EN_GEO_TOKEN_MAP = new Map(
  Object.entries({
    "san jose": "圣何西",
    sanjose: "圣何西",
    kowloon: "九龙",
    "hong kong": "香港",
    hongkong: "香港",
    california: "加州",
    lombardy: "伦巴第",
    lombardia: "伦巴第",
    gallarate: "加拉拉泰",
    "new york": "纽约",
    texas: "德克萨斯",
    florida: "佛罗里达",
    washington: "华盛顿",
    virginia: "弗吉尼亚",
    london: "伦敦",
    milan: "米兰",
    rome: "罗马",
    singapore: "新加坡",
    tokyo: "东京",
    osaka: "大阪",
    seoul: "首尔",
    sydney: "悉尼",
    melbourne: "墨尔本",
    frankfurt: "法兰克福",
    amsterdam: "阿姆斯特丹",
    paris: "巴黎",
    berlin: "柏林",
    dublin: "都柏林",
    toronto: "多伦多",
    vancouver: "温哥华",
    seattle: "西雅图",
    chicago: "芝加哥",
    dallas: "达拉斯",
    miami: "迈阿密",
    ashburn: "阿什本",
    "silicon valley": "硅谷",
    guangdong: "广东",
    fujian: "福建",
    shenzhen: "深圳",
    xiamen: "厦门",
    hangzhou: "杭州",
    shanghai: "上海",
    beijing: "北京",
    guangzhou: "广州",
    taipei: "台北",
    taoyuan: "桃园",
    kaohsiung: "高雄"
  }).map(([k, v]) => [k.toLowerCase(), v])
);

const TRAD_TO_SIMP_PAIRS = [
  ["聖", "圣"],
  ["臺", "台"],
  ["灣", "湾"],
  ["國", "国"],
  ["區", "区"],
  ["亞", "亚"],
  ["歐", "欧"],
  ["內", "内"],
  ["網", "网"],
  ["廣", "广"],
  ["門", "门"],
  ["島", "岛"],
  ["東", "东"],
  ["華", "华"],
  ["倫", "伦"],
  ["達", "达"],
  ["羅", "罗"],
  ["馬", "马"],
  ["爾", "尔"],
  ["蘭", "兰"],
  ["貝", "贝"],
  ["舊", "旧"],
  ["舊金山", "旧金山"],
  ["舊金", "旧金"]
];

function tradToSimpChars(s) {
  if (s == null) return s;
  let out = String(s);
  for (const [a, b] of TRAD_TO_SIMP_PAIRS) {
    if (a !== b) out = out.split(a).join(b);
  }
  return out;
}

function translateEnglishGeoTokens(s) {
  if (!s) return s;
  let out = String(s);
  const keys = Array.from(EN_GEO_TOKEN_MAP.keys()).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const zh = EN_GEO_TOKEN_MAP.get(key);
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(esc, "gi");
    out = out.replace(re, zh);
  }
  return out;
}

function normalizeSanJoseSpelling(s) {
  return String(s)
    .replace(/聖荷西/g, "圣何西")
    .replace(/圣荷西/g, "圣何西")
    .replace(/圣何塞/g, "圣何西");
}

/** 疑似小区/屋苑英文名：不拼进「落地国家地区」主串，避免 #香港Banyan Garden1 */
function isLikelyHousingOrEstatesName(city, country) {
  const t = String(city || "").trim();
  if (!t) return false;
  const c = String(country || "").toLowerCase();
  const isHk = /hong kong|香港/.test(c);
  if (!isHk) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return false;
  return /(garden|court|village|estate|tower|phase|center|centre|house|banyan|liberte|bay|heights|mansions|park)/i.test(
    t
  );
}

/**
 * 通用拼接：国家 + 省州 + 城市（去重）。
 */
function joinLocationParts(country, regionName, city) {
  const c = String(country || "").trim();
  const r = String(regionName || "").trim();
  const t = String(city || "").trim();
  const parts = [];

  if (c) parts.push(c);
  if (r) {
    const rNorm = r.toLowerCase();
    const cNorm = c.toLowerCase();
    if (r !== c && rNorm !== cNorm && !(c && c.includes(r)) && !(r && r.includes(c))) parts.push(r);
    else if (!c) parts.push(r);
  }
  if (t) {
    const tNorm = t.toLowerCase();
    const cNorm = c.toLowerCase();
    const rNorm = r.toLowerCase();
    const dupCountry =
      c &&
      (t === c ||
        tNorm === cNorm ||
        (c.length >= 2 && t.length >= 2 && (c.includes(t) || t.includes(c))));
    const dupRegion =
      r &&
      (t === r ||
        tNorm === rNorm ||
        (r.length >= 2 && t.length >= 2 && (r.includes(t) || t.includes(r))));
    if (!dupCountry && !dupRegion) parts.push(t);
  }
  return parts.join("");
}

/**
 * 落地展示：国家 + 省/州 + 区(若有) + 城市（可抑制屋苑级英文名）。
 */
function joinExitLocationParts(country, regionName, district, city) {
  const c = String(country || "").trim();
  const r = String(regionName || "").trim();
  const d = String(district || "").trim();
  let t = String(city || "").trim();
  if (isLikelyHousingOrEstatesName(t, c)) t = "";
  const parts = [];
  if (c) parts.push(c);
  if (r && r !== c && !(c && (c.includes(r) || r.includes(c)))) parts.push(r);
  if (d && d !== r && d !== c && !(c && c.includes(d))) parts.push(d);
  if (t && t !== c && t !== r && t !== d) {
    const dup = parts.some((p) => (p && (p.includes(t) || t.includes(p))) || false);
    if (!dup) parts.push(t);
  }
  return parts.join("");
}

function prepGeoField(cfg, s) {
  const lang = String(cfg?.geoApi?.lang || "").toLowerCase();
  let x = String(s || "").trim();
  if (!x) return "";
  x = translateEnglishCountryPhrases(x);
  x = translateEnglishGeoTokens(x);
  if (lang.startsWith("zh")) x = tradToSimpChars(x);
  return x.trim();
}

/**
 * 落地地区：国家+省州+（区）+城市 → 单一简体中文串
 * @param {{ mode?: 'exit'|'node', district?: string }} [opts]
 */
function localizeGeoLabel(cfg, country, regionName, city, opts = {}) {
  const lang = String(cfg?.geoApi?.lang || "").toLowerCase();
  const mode = opts.mode || "node";
  const c0 = String(country || "").trim();
  const r0 = String(regionName || "").trim();
  const d0 = String(opts.district || "").trim();
  let t0 = String(city || "").trim();

  if (mode === "exit" && isLikelyHousingOrEstatesName(t0, c0)) t0 = "";

  const c = prepGeoField(cfg, c0);
  const r = prepGeoField(cfg, r0);
  const d = prepGeoField(cfg, d0);
  const t = t0 ? prepGeoField(cfg, t0) : "";

  let joined = mode === "exit" ? joinExitLocationParts(c, r, d, t) : joinLocationParts(c, r, t);
  if (!joined) return "";

  if (lang.startsWith("zh")) {
    joined = tradToSimpChars(joined);
    joined = translateEnglishGeoTokens(joined);
    joined = tradToSimpChars(joined);
    joined = normalizeSanJoseSpelling(joined);
  } else {
    joined = translateEnglishGeoTokens(joined);
    joined = normalizeSanJoseSpelling(joined);
  }
  joined = translateEnglishCountryPhrases(joined);
  joined = translateEnglishGeoTokens(joined);
  joined = normalizeSanJoseSpelling(joined);
  return joined.trim();
}

function localizeCityName(cfg, city) {
  const lang = String(cfg?.geoApi?.lang || "").toLowerCase();
  let s = String(city || "").trim();
  if (!s) return "";
  if (lang.startsWith("zh")) {
    s = tradToSimpChars(s);
    s = translateEnglishGeoTokens(s);
    s = tradToSimpChars(s);
    s = normalizeSanJoseSpelling(s);
  } else {
    s = translateEnglishGeoTokens(s);
    s = normalizeSanJoseSpelling(s);
  }
  return s.trim();
}

module.exports = {
  localizeGeoLabel,
  localizeCityName,
  joinLocationParts,
  joinExitLocationParts,
  tradToSimpChars,
  translateEnglishGeoTokens
};
