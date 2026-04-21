/* eslint-disable no-console */

const fs = require("node:fs/promises");
const path = require("node:path");

const { parseFofaToIpPorts } = require("./fofa");
const { loadConfig } = require("./config");
const { runFullPipeline } = require("./runner");

function printHelp() {
  console.log(`
用法:
  ip-clash-speedtool --stdin [--config ./config.json]
  ip-clash-speedtool --input ./fofa.txt [--config ./config.json]

说明:
  - 从 FOFA 复制文本中提取去重 IP:端口（优先解析 https?://IP:PORT 形式；缺省端口按 443）
  - 查询节点本身 IP 的 城市 + ASN 全称（ip-api.com，内置限速）
  - 启动无头 Mihomo，导入节点并逐个做 delay 测试，剔除 timeout
  - 对每个可用节点切换为 GLOBAL，走本地代理请求 ipify 获取落地 IP，再查国家/地区
  - 输出:
      IP:端口 #落地国家地区+序号+空格+节点城市+中转+空格+ASN全称
`);
}

function getArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(args, name) {
  return args.includes(name);
}

async function readAllStdin() {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (d) => chunks.push(Buffer.from(d)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

async function safeWriteFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function main(args) {
  if (hasFlag(args, "-h") || hasFlag(args, "--help") || args.length === 0) {
    printHelp();
    return;
  }

  const configPath = getArgValue(args, "--config") || path.resolve(process.cwd(), "config.json");
  const cfg = await loadConfig(configPath);

  let rawText = "";
  if (hasFlag(args, "--stdin")) {
    rawText = await readAllStdin();
  } else {
    const inputPath = getArgValue(args, "--input");
    if (!inputPath) throw new Error("缺少参数：--stdin 或 --input <file>");
    rawText = await fs.readFile(path.resolve(process.cwd(), inputPath), "utf8");
  }

  const ipPorts = parseFofaToIpPorts(rawText);
  if (ipPorts.length === 0) {
    console.error("未从输入中解析到任何 IP:端口。请确认 FOFA 文本包含形如 https://1.2.3.4:443 或 IP/Port 列。");
    process.exitCode = 2;
    return;
  }

  const result = await runFullPipeline(cfg, rawText, {
    log: (s) => console.log(s)
  });

  if (!result.lines || result.lines.length === 0) {
    console.log("无可用节点输出。失败原因统计：");
    console.log(JSON.stringify(result.failuresSummary || {}, null, 2));
    return;
  }

  console.log("\n==== 结果 ====");
  console.log(result.lines.join("\n"));
}

async function runCli(args) {
  await main(args);
}

module.exports = { runCli };

