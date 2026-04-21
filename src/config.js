const fs = require("node:fs/promises");
const path = require("node:path");

function deepMerge(base, patch) {
  if (patch == null) return base;
  if (typeof base !== "object" || base == null) return patch;
  if (typeof patch !== "object" || patch == null) return patch;
  if (Array.isArray(base) || Array.isArray(patch)) return patch;

  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = deepMerge(base[k], v);
  }
  return out;
}

async function loadJsonIfExists(p) {
  try {
    const s = await fs.readFile(p, "utf8");
    return JSON.parse(s);
  } catch (e) {
    if (e && (e.code === "ENOENT" || e.code === "ENOTDIR")) return null;
    throw e;
  }
}

async function loadConfig(configPath) {
  const resolved = path.resolve(process.cwd(), configPath);
  const examplePath = path.resolve(__dirname, "../config.example.json");
  const base = JSON.parse(await fs.readFile(examplePath, "utf8"));
  const userCfg = await loadJsonIfExists(resolved);

  const cfg = deepMerge(base, userCfg || {});

  // env override（可选）
  if (process.env.MIHOMO_BIN) cfg.mihomo.binPath = process.env.MIHOMO_BIN;
  if (process.env.MIHOMO_SECRET != null) cfg.mihomo.secret = process.env.MIHOMO_SECRET;
  if (process.env.MIHOMO_MIXED_PORT) cfg.mihomo.mixedPort = Number(process.env.MIHOMO_MIXED_PORT);
  if (process.env.MIHOMO_CTRL) cfg.mihomo.externalController = process.env.MIHOMO_CTRL;

  return cfg;
}

module.exports = { loadConfig };

