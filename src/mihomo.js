const fs = require("node:fs/promises");
const fssync = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");

const { sleep } = require("./sleep");
const { fetchLatestReleaseAssetUrl } = require("./mihomoDownload");

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureMihomoBinary(cfg) {
  const binPath = path.resolve(process.cwd(), cfg.mihomo.binPath);
  const workDir = path.resolve(process.cwd(), cfg.mihomo.workDir);
  await fs.mkdir(workDir, { recursive: true });

  if (await fileExists(binPath)) return;
  if (!cfg.mihomo.autoDownload) {
    throw new Error(`未找到 mihomo 可执行文件：${binPath}，且已关闭自动下载（mihomo.autoDownload=false）`);
  }

  const platform = process.platform;
  const arch = process.arch;
  if (platform !== "linux") {
    throw new Error(`当前示例实现仅自动下载 linux，检测到 platform=${platform}。请手动下载 mihomo 并设置 mihomo.binPath`);
  }
  if (!["x64", "arm64"].includes(arch)) {
    throw new Error(`暂不支持自动下载该架构 arch=${arch}，请手动下载 mihomo 并设置 mihomo.binPath`);
  }

  const url = await fetchLatestReleaseAssetUrl(cfg.mihomo.download, { platform, arch });
  if (!url) throw new Error("无法从 GitHub releases 解析到可用的 mihomo 资产下载地址（可能被网络/代理拦截）");

  const tmpPath = path.join(workDir, `mihomo.tmp.${Date.now()}`);
  await downloadToFile(url, tmpPath);

  // 部分 release 可能是压缩包；这里尝试识别常见格式（仅支持 .gz / .zip 的最简路径）
  const finalPath = binPath;
  await fs.mkdir(path.dirname(finalPath), { recursive: true });

  if (url.endsWith(".gz")) {
    await gunzipToFile(tmpPath, finalPath);
    await fs.unlink(tmpPath).catch(() => {});
  } else if (url.endsWith(".zip")) {
    await unzipSingleBinary(tmpPath, finalPath);
    await fs.unlink(tmpPath).catch(() => {});
  } else {
    await fs.rename(tmpPath, finalPath);
  }

  await fs.chmod(finalPath, 0o755);
}

async function downloadToFile(url, filePath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`下载失败：HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filePath, buf);
}

async function gunzipToFile(gzPath, outPath) {
  const zlib = require("node:zlib");
  const { pipeline } = require("node:stream/promises");
  await pipeline(fssync.createReadStream(gzPath), zlib.createGunzip(), fssync.createWriteStream(outPath));
}

async function unzipSingleBinary(zipPath, outPath) {
  // 无依赖 unzip：调用系统 unzip（多数 Linux 自带）。如果没有，请用户手动处理。
  // 这里解压到临时目录后，找一个名为 mihomo* 的可执行文件复制过去。
  const { execFile } = require("node:child_process");
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mihomo-zip-"));
  await new Promise((resolve, reject) => {
    execFile("unzip", ["-o", zipPath, "-d", tmpDir], (err) => (err ? reject(err) : resolve()));
  });

  const found = await findBinaryInDir(tmpDir);
  if (!found) throw new Error("zip 解压后未找到 mihomo 可执行文件");
  await fs.copyFile(found, outPath);
  await fs.rm(tmpDir, { recursive: true, force: true });
}

async function findBinaryInDir(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) {
      const sub = await findBinaryInDir(p);
      if (sub) return sub;
    } else {
      if (/^mihomo(\.exe)?$/i.test(it.name) || /^mihomo-/.test(it.name)) return p;
    }
  }
  return null;
}

async function startMihomo(cfg) {
  const binPath = path.resolve(process.cwd(), cfg.mihomo.binPath);
  const configPath = path.resolve(process.cwd(), cfg.mihomo.configPath);
  const workDir = path.resolve(process.cwd(), cfg.mihomo.workDir);
  const logPath = path.resolve(process.cwd(), cfg.mihomo.logPath);

  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const logFd = fssync.openSync(logPath, "a");

  const proc = spawn(binPath, ["-d", workDir, "-f", configPath], {
    stdio: ["ignore", logFd, logFd]
  });

  // 简单等待 controller 端口可用
  await waitControllerUp(cfg, 15000);

  return { proc, logFd };
}

async function waitControllerUp(cfg, timeoutMs) {
  const base = controllerBase(cfg);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/version`, { headers: authHeaders(cfg) });
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await sleep(500);
  }
  throw new Error("Mihomo external-controller 未就绪（请检查端口占用/二进制是否可执行/日志）");
}

function controllerBase(cfg) {
  const host = cfg.mihomo.externalController;
  const norm = host.startsWith("http://") || host.startsWith("https://") ? host : `http://${host}`;
  return norm.replace(/\/+$/, "");
}

function authHeaders(cfg) {
  const secret = String(cfg.mihomo.secret || "");
  if (!secret) return {};
  return { Authorization: `Bearer ${secret}` };
}

async function stopMihomo(handle) {
  if (!handle) return;
  try {
    handle.proc.kill("SIGTERM");
  } catch {
    // ignore
  }
  try {
    fssync.closeSync(handle.logFd);
  } catch {
    // ignore
  }
}

module.exports = { ensureMihomoBinary, startMihomo, stopMihomo, controllerBase, authHeaders };

