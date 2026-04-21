/* eslint-disable no-console */

const http = require("node:http");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { loadConfig } = require("../config");
const { runFullPipeline } = require("../runner");

const CONFIG_PATH = path.resolve(process.cwd(), "config.json");

function json(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(body.length),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function text(res, status, s, contentType = "text/plain; charset=utf-8") {
  const body = Buffer.from(String(s));
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": String(body.length),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

async function readBody(req, limitBytes = 5 * 1024 * 1024) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (d) => {
      size += d.length;
      if (size > limitBytes) {
        reject(new Error("body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(d);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function ensureConfigFileExists() {
  try {
    await fs.access(CONFIG_PATH);
  } catch {
    const example = await fs.readFile(path.resolve(__dirname, "../../config.example.json"), "utf8");
    await fs.writeFile(CONFIG_PATH, example, "utf8");
  }
}

function safeParseJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function generateId() {
  return crypto.randomBytes(12).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function createJobState({ id }) {
  return {
    id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    stage: "queued",
    progress: { done: 0, total: 0 },
    logs: [],
    status: "running", // running | done | error
    error: null,
    result: null
  };
}

function pushLog(job, line) {
  const s = `[${new Date().toLocaleTimeString()}] ${line}`;
  job.logs.push(s);
  if (job.logs.length > 2000) job.logs.splice(0, job.logs.length - 2000);
  job.updatedAt = nowIso();
}

async function startWebServer() {
  await ensureConfigFileExists();
  const cfg = await loadConfig(CONFIG_PATH);
  const host = cfg.web?.host || "127.0.0.1";
  const port = Number(cfg.web?.port || 8787);

  const jobs = new Map(); // id -> state

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

      // 静态页面
      if (req.method === "GET" && url.pathname === "/") {
        const html = await fs.readFile(path.resolve(__dirname, "ui.html"), "utf8");
        return text(res, 200, html, "text/html; charset=utf-8");
      }
      if (req.method === "GET" && url.pathname === "/ui.js") {
        const js = await fs.readFile(path.resolve(__dirname, "ui.js"), "utf8");
        return text(res, 200, js, "text/javascript; charset=utf-8");
      }

      // 配置：读取
      if (req.method === "GET" && url.pathname === "/api/config") {
        const raw = await fs.readFile(CONFIG_PATH, "utf8");
        const obj = safeParseJson(raw);
        return json(res, 200, { path: CONFIG_PATH, config: obj });
      }

      // 配置：保存
      if (req.method === "PUT" && url.pathname === "/api/config") {
        const body = await readBody(req);
        const obj = safeParseJson(body.toString("utf8"));
        if (!obj) return json(res, 400, { error: "invalid_json" });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(obj, null, 2), "utf8");
        return json(res, 200, { ok: true });
      }

      // 诊断：检查 Geo API / ipify / mihomo controller
      if (req.method === "GET" && url.pathname === "/api/diag") {
        const cfg2 = await loadConfig(CONFIG_PATH);
        const startedAt = Date.now();
        const diag = { startedAt: new Date(startedAt).toISOString(), checks: {} };

        async function timeit(name, fn) {
          const t0 = Date.now();
          try {
            const data = await fn();
            diag.checks[name] = { ok: true, ms: Date.now() - t0, data };
          } catch (e) {
            diag.checks[name] = { ok: false, ms: Date.now() - t0, error: String(e?.message || e) };
          }
        }

        const { geoLookupBatch } = require("../geo");
        const { controllerBase, authHeaders } = require("../mihomo");

        await timeit("geo_8.8.8.8", async () => {
          const r = await geoLookupBatch(cfg2, ["8.8.8.8"]);
          return r.get("8.8.8.8") || null;
        });

        await timeit("ipify_direct", async () => {
          const ac = new AbortController();
          const to = setTimeout(() => ac.abort(new Error("timeout")), 6000);
          try {
            const resp = await fetch(cfg2.ipifyUrl, { signal: ac.signal });
            const j = await resp.json();
            return { status: resp.status, ip: j.ip || null };
          } finally {
            clearTimeout(to);
          }
        });

        await timeit("mihomo_controller_version", async () => {
          const base = controllerBase(cfg2);
          const ac = new AbortController();
          const to = setTimeout(() => ac.abort(new Error("timeout")), 2000);
          try {
            const resp = await fetch(`${base}/version`, { headers: authHeaders(cfg2), signal: ac.signal });
            const txt = await resp.text();
            return { status: resp.status, body: txt.slice(0, 200) };
          } finally {
            clearTimeout(to);
          }
        });

        diag.totalMs = Date.now() - startedAt;
        return json(res, 200, diag);
      }

      // 创建任务
      if (req.method === "POST" && url.pathname === "/api/jobs") {
        const body = await readBody(req);
        const payload = safeParseJson(body.toString("utf8"));
        if (!payload || typeof payload.fofaText !== "string") {
          return json(res, 400, { error: "invalid_payload", need: { fofaText: "string" } });
        }

        const id = generateId();
        const job = createJobState({ id });
        jobs.set(id, job);

        // 异步运行
        (async () => {
          job.stage = "load_config";
          job.updatedAt = nowIso();
          pushLog(job, "加载配置...");
          const cfg2 = await loadConfig(CONFIG_PATH);

          // 允许 payload 覆盖并发/重试（只覆盖这几项，避免把秘密写进日志/前端）
          if (payload.testOverrides && typeof payload.testOverrides === "object") {
            cfg2.test = cfg2.test || {};
            for (const k of ["maxConcurrency", "retries", "retryBackoffMs", "timeoutMs"]) {
              if (payload.testOverrides[k] != null) cfg2.test[k] = payload.testOverrides[k];
            }
          }

          try {
            const r = await runFullPipeline(cfg2, payload.fofaText, {
              setStage: (s) => {
                job.stage = s;
                job.updatedAt = nowIso();
              },
              log: (s) => pushLog(job, s),
              onProgress: (p) => {
                job.progress = p;
                job.updatedAt = nowIso();
              }
            });

            job.status = "done";
            job.result = {
              lines: r.lines || [],
              failuresSummary: r.failuresSummary || {},
              totals: {
                parsed: r.ipPorts?.length || 0,
                tested: r.tested?.length || 0,
                ok: r.ok?.length || 0
              }
            };
            pushLog(job, `完成：parsed=${job.result.totals.parsed} ok=${job.result.totals.ok}`);
            job.updatedAt = nowIso();
          } catch (e) {
            job.status = "error";
            job.error = String(e?.stack || e?.message || e);
            pushLog(job, `错误：${job.error}`);
            job.updatedAt = nowIso();
          }
        })();

        return json(res, 200, { id });
      }

      // 查询任务
      const jobMatch = url.pathname.match(/^\/api\/jobs\/([a-f0-9]+)$/);
      if (req.method === "GET" && jobMatch) {
        const id = jobMatch[1];
        const job = jobs.get(id);
        if (!job) return json(res, 404, { error: "not_found" });
        return json(res, 200, job);
      }

      // 简单健康检查
      if (req.method === "GET" && url.pathname === "/healthz") {
        return text(res, 200, "ok");
      }

      return json(res, 404, { error: "not_found" });
    } catch (e) {
      return json(res, 500, { error: "internal_error", detail: String(e?.message || e) });
    }
  });

  await new Promise((resolve) => server.listen(port, host, resolve));
  console.log(`WebUI 已启动： http://${host}:${port}/`);
  console.log(`配置文件： ${CONFIG_PATH}`);

  // 让进程常驻
  process.on("SIGINT", () => {
    console.log("收到 SIGINT，退出...");
    server.close(() => process.exit(0));
  });
}

module.exports = { startWebServer };

