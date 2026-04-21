async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ip-clash-speedtool",
      Accept: "application/vnd.github+json"
    }
  });
  if (!res.ok) throw new Error(`GitHub API 请求失败：HTTP ${res.status} ${res.statusText}`);
  return await res.json();
}

function scoreAsset(name, hints, preferCompressed) {
  const lower = String(name).toLowerCase();
  let score = 0;
  for (const h of hints) {
    if (lower.includes(String(h).toLowerCase())) score += 10;
  }
  if (preferCompressed) {
    if (lower.endsWith(".gz")) score += 2;
    if (lower.endsWith(".zip")) score += 1;
  } else {
    if (lower.endsWith(".gz")) score -= 2;
    if (lower.endsWith(".zip")) score -= 1;
  }
  // 不要 sbom/sha256 等
  if (lower.includes("sha256") || lower.includes("checksums") || lower.endsWith(".txt")) score -= 50;
  if (lower.includes("sbom")) score -= 50;
  return score;
}

function buildHints(downloadCfg, runtime) {
  const hints = Array.isArray(downloadCfg.assetNameHints) ? [...downloadCfg.assetNameHints] : [];
  // 额外根据 arch/platform 增强匹配
  if (runtime.platform === "linux") hints.push("linux");
  if (runtime.arch === "x64") {
    hints.push("amd64", "x86_64", "x64");
  } else if (runtime.arch === "arm64") {
    hints.push("arm64", "aarch64");
  }
  return hints;
}

/**
 * 从 GitHub releases 解析 latest 的可下载资产 URL
 * downloadCfg: { repo, assetNameHints, preferCompressed }
 */
async function fetchLatestReleaseAssetUrl(downloadCfg, runtime) {
  const repo = downloadCfg.repo || "MetaCubeX/mihomo";
  const api = `https://api.github.com/repos/${repo}/releases/latest`;
  const json = await fetchJson(api);
  const assets = Array.isArray(json.assets) ? json.assets : [];

  const hints = buildHints(downloadCfg, runtime);
  const preferCompressed = Boolean(downloadCfg.preferCompressed);

  let best = null;
  for (const a of assets) {
    const name = a.name;
    const url = a.browser_download_url;
    if (!name || !url) continue;
    const s = scoreAsset(name, hints, preferCompressed);
    if (!best || s > best.score) best = { score: s, url, name };
  }

  return best?.url || null;
}

module.exports = { fetchLatestReleaseAssetUrl };

