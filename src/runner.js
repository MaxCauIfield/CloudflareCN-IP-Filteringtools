const fs = require("node:fs/promises");
const path = require("node:path");

const { parseFofaToIpPorts } = require("./fofa");
const { geoLookupBatch, geoLookupExitMerged } = require("./geo");
const { localizeGeoLabel, localizeCityName } = require("./geoLocale");
const { ensureMihomoBinary, startMihomo, stopMihomo } = require("./mihomo");
const { buildMihomoConfigYaml } = require("./mihomoConfig");
const { mihomoDelayTest, mihomoSelectGlobal } = require("./mihomoApi");
const { getExitIpViaLocalProxy } = require("./proxyHttp");
const { sleep } = require("./sleep");

async function safeWriteFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

function classifyDelayFailure(delayMs) {
  if (delayMs == null) return "request_error";
  if (typeof delayMs !== "number" || !Number.isFinite(delayMs)) return "invalid_response";
  if (delayMs <= 0) return "timeout";
  return null;
}

function classifyException(err) {
  const msg = String(err?.message || "");
  if (/timeout/i.test(msg)) return "timeout";
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH/i.test(msg)) return "network_error";
  if (/Client network socket disconnected before secure TLS connection/i.test(msg)) return "network_error";
  if (/401|403|unauthorized|forbidden/i.test(msg)) return "auth_error";
  return "request_error";
}

async function delayTestWithRetry(cfg, proxyName) {
  const retries = Math.max(0, Number(cfg.test.retries ?? 0));
  const backoff = Math.max(0, Number(cfg.test.retryBackoffMs ?? 0));
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const d = await mihomoDelayTest(cfg, proxyName);
      const fail = classifyDelayFailure(d);
      if (!fail) return { ok: true, delayMs: d, attempts: attempt + 1 };
      lastErr = new Error(fail);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < retries && backoff > 0) await sleep(backoff * (attempt + 1));
  }
  return { ok: false, delayMs: null, attempts: retries + 1, reason: classifyException(lastErr) };
}

async function runPool(items, worker, maxConcurrency, onProgress) {
  const concurrency = Math.max(1, Number(maxConcurrency || 1));
  let idx = 0;
  let active = 0;
  const results = [];
  let done = 0;

  return await new Promise((resolve, reject) => {
    const launch = () => {
      while (active < concurrency && idx < items.length) {
        const myIdx = idx++;
        active += 1;
        Promise.resolve()
          .then(() => worker(items[myIdx], myIdx))
          .then((r) => {
            results[myIdx] = r;
            active -= 1;
            done += 1;
            onProgress?.({ done, total: items.length });
            if (done === items.length) resolve(results);
            else launch();
          })
          .catch((e) => reject(e));
      }
    };
    launch();
  });
}

/**
 * 核心流程：输入 FOFA 原文 -> 输出最终行（按你指定格式）
 * 返回 { ipPorts, nodeMetaMap, tested, ok, lines, failuresSummary }
 */
async function runFullPipeline(cfg, rawFofaText, hooks = {}) {
  const log = hooks.log || (() => {});
  const setStage = hooks.setStage || (() => {});
  const onProgress = hooks.onProgress || (() => {});

  setStage("read");
  onProgress({ done: 0, total: 6, step: 1, stepName: "读取" });
  setStage("parse");
  onProgress({ done: 0, total: 6, step: 2, stepName: "列出去重/筛选端口号" });
  const ipPorts = parseFofaToIpPorts(rawFofaText);
  if (ipPorts.length === 0) {
    return {
      ipPorts: [],
      lines: [],
      failuresSummary: { parse: ipPorts.length === 0 ? 1 : 0 }
    };
  }

  setStage("geo_node");
  onProgress({ done: 0, total: 6, step: 3, stepName: "查询节点信息(城市/ASN)" });
  log(`解析到去重后 IP:端口 共 ${ipPorts.length} 个，查询节点本身城市/ASN...`);
  const nodeIpMetas = await geoLookupBatch(cfg, ipPorts.map((x) => x.ip), {
    phase: "geo_node",
    onProgress: (info) => {
      onProgress({
        done: info.index,
        total: info.total,
        step: 3,
        stepName: "查询节点信息(城市/ASN)",
        detail: `测地区(API) 节点IP ${info.ip} (${info.index}/${info.total})${info.preview ? ` → ${info.preview}` : ""}`
      });
      log(
        `Geo节点 ${info.ip} (${info.index}/${info.total})${info.preview ? ` → ${info.preview}` : ""}`
      );
    }
  });

  setStage("mihomo_prepare");
  onProgress({ done: 0, total: 6, step: 4, stepName: "生成配置/启动核心" });
  await ensureMihomoBinary(cfg);

  const yaml = buildMihomoConfigYaml(
    cfg,
    ipPorts.map((x) => ({ server: x.ip, port: x.port }))
  );
  await safeWriteFile(path.resolve(process.cwd(), cfg.mihomo.configPath), yaml);

  setStage("mihomo_start");
  const mihomo = await startMihomo(cfg);

  try {
    setStage("delay_test");
    // 测速阶段：progress 用 done/total 表示条目进度
    onProgress({ done: 0, total: ipPorts.length, step: 5, stepName: "测速(连通性/延迟)" });
    log(
      `开始并发测速（timeout/失败将剔除）... maxConcurrency=${cfg.test.maxConcurrency} timeoutMs=${cfg.test.timeoutMs} retries=${cfg.test.retries}`
    );

    const failures = new Map(); // reason -> count
    const tested = await runPool(
      ipPorts,
      async (x) => {
        const proxyName = `IP ${x.ip}:${x.port}`;
        log(`测速开始 ${proxyName}`);
        const r = await delayTestWithRetry(cfg, proxyName);
        if (!r.ok) {
          failures.set(r.reason, (failures.get(r.reason) || 0) + 1);
          log(`测速失败 ${proxyName} reason=${r.reason} attempts=${r.attempts}`);
        } else {
          log(`测速成功 ${proxyName} delay=${r.delayMs}ms attempts=${r.attempts}`);
        }
        return { ...x, ...r, proxyName };
      },
      cfg.test.maxConcurrency,
      (p) => onProgress({ ...p, step: 5, stepName: "测速(连通性/延迟)" })
    );

    const ok = tested.filter((t) => t.ok);
    if (ok.length === 0) {
      return {
        ipPorts,
        nodeIpMetas,
        tested,
        ok,
        lines: [],
        failuresSummary: Object.fromEntries(failures.entries())
      };
    }

    setStage("exit_ip");
    // 出口探测阶段：progress 用 done/total 表示节点序号进度
    onProgress({ done: 0, total: ok.length, step: 6, stepName: "测试出口IP/最终输出" });
    log(`测速通过 ${ok.length} 个，开始逐个探测落地 IP...`);

    const lines = [];
    const exitFailures = new Map(); // reason
    let seq = 1;
    for (const x of ok) {
      onProgress({ done: seq - 1, total: ok.length, step: 6, stepName: "测试出口IP/最终输出" });
      try {
        await mihomoSelectGlobal(cfg, x.proxyName);
        const exitIp = await getExitIpViaLocalProxy(cfg);
        if (!exitIp) {
          exitFailures.set("exit_ip_fetch_failed", (exitFailures.get("exit_ip_fetch_failed") || 0) + 1);
          log(`落地IP失败 ${x.proxyName}（将尝试调整 exitIpProviders / 检查大陆网络对目标站点TLS重置）`);
          continue;
        }
        onProgress({
          done: seq - 1,
          total: ok.length,
          step: 6,
          stepName: "测试出口IP/最终输出",
          detail: `测地区(API) 落地IP ${exitIp}（合并多源补全省州）…`
        });
        const exitMeta = await geoLookupExitMerged(cfg, exitIp);
        onProgress({
          done: seq - 1,
          total: ok.length,
          step: 6,
          stepName: "测试出口IP/最终输出",
          detail: `测地区(API) 落地IP ${exitIp} → ${exitMeta ? [exitMeta.city, exitMeta.regionName, exitMeta.country].filter(Boolean).join(" / ") : "(无结果)"}`
        });
        const exitLoc = exitMeta
          ? localizeGeoLabel(cfg, exitMeta.country, exitMeta.regionName, exitMeta.city, {
              mode: "exit",
              district: exitMeta.district
            }) || "未知地区"
          : "未知地区";

        const nodeMeta = nodeIpMetas.get(x.ip);
        const nodeCityRaw = nodeMeta?.city || nodeMeta?.regionName || "";
        const nodeCity = nodeCityRaw
          ? localizeCityName(cfg, nodeCityRaw) || nodeCityRaw
          : "未知城市";
        /** 节点 ASN：使用查询 API 返回的 as/org 原文解析结果，不做翻译或改写 */
        const asnFull = nodeMeta?.asnFull != null ? String(nodeMeta.asnFull) : "未知ASN";

        lines.push(`${x.ip}:${x.port}#${exitLoc}${seq} ${nodeCity}中转 ${asnFull}`);
        seq += 1;
      } catch (e) {
        const reason = classifyException(e);
        exitFailures.set(reason, (exitFailures.get(reason) || 0) + 1);
      }
      // 避免切换过快造成不稳定（给隧道一点时间）
      await sleep(150);
    }

    setStage("done");
    onProgress({ done: ok.length, total: ok.length, step: 6, stepName: "测试出口IP/最终输出" });
    const merged = new Map(failures);
    for (const [k, v] of exitFailures.entries()) merged.set(k, (merged.get(k) || 0) + v);

    return {
      ipPorts,
      nodeIpMetas,
      tested,
      ok,
      lines,
      failuresSummary: Object.fromEntries(merged.entries())
    };
  } finally {
    await stopMihomo(mihomo);
  }
}

module.exports = { runFullPipeline };

