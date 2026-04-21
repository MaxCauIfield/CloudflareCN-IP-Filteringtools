function isValidIp(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

function normalizePort(portStr) {
  const p = Number(portStr);
  if (!Number.isFinite(p)) return null;
  if (p < 1 || p > 65535) return null;
  return p;
}

/**
 * 从 FOFA 复制的表格文本中提取去重后的 IP:端口 列表。
 * 优先解析 https?://IP:PORT 形式；若无端口则默认 443。
 * 返回格式：[{ ip, port }]
 */
function parseFofaToIpPorts(rawText) {
  const text = String(rawText || "");
  const out = [];
  const seen = new Set();

  // 1) URL 形式：https://1.2.3.4:443 或 https://1.2.3.4
  const urlRe = /\bhttps?:\/\/(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?\b/g;
  for (const m of text.matchAll(urlRe)) {
    const ip = m[1];
    const port = normalizePort(m[2] || "443");
    if (!isValidIp(ip) || port == null) continue;
    const key = `${ip}:${port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ip, port });
  }

  // 2) 兜底：单独出现 IP + 附近出现 Port 列（简化：寻找 “IP(空白)PORT”）
  // 例如：120.77.168.9  3307
  const pairRe = /\b(\d{1,3}(?:\.\d{1,3}){3})\b[\t ]+(\d{2,5})\b/g;
  for (const m of text.matchAll(pairRe)) {
    const ip = m[1];
    const port = normalizePort(m[2]);
    if (!isValidIp(ip) || port == null) continue;
    const key = `${ip}:${port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ip, port });
  }

  return out;
}

module.exports = { parseFofaToIpPorts };

