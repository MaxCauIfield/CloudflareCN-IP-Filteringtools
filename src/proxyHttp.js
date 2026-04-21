const net = require("node:net");
const tls = require("node:tls");
const { URL } = require("node:url");

function readUntil(socket, matcher, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const t = setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, timeoutMs);

    function onData(d) {
      buf = Buffer.concat([buf, d]);
      const idx = matcher(buf);
      if (idx >= 0) {
        cleanup();
        resolve(buf);
      }
    }
    function onErr(e) {
      cleanup();
      reject(e);
    }
    function onEnd() {
      cleanup();
      reject(new Error("socket_ended"));
    }
    function cleanup() {
      clearTimeout(t);
      socket.off("data", onData);
      socket.off("error", onErr);
      socket.off("end", onEnd);
    }

    socket.on("data", onData);
    socket.on("error", onErr);
    socket.on("end", onEnd);
  });
}

function indexOfHeaderEnd(buf) {
  return buf.indexOf("\r\n\r\n");
}

function parseHttpResponse(buffer) {
  const he = indexOfHeaderEnd(buffer);
  if (he < 0) throw new Error("bad_http_response");
  const headersText = buffer.slice(0, he).toString("utf8");
  const statusLine = headersText.split("\r\n")[0] || "";
  const m = statusLine.match(/^HTTP\/1\.[01]\s+(\d+)/i);
  const code = m ? Number(m[1]) : 0;
  const body = buffer.slice(he + 4);
  return { code, headersText, body };
}

function waitEvent(emitter, event, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, timeoutMs);
    const onOk = (...args) => {
      cleanup();
      resolve(args);
    };
    const onErr = (e) => {
      cleanup();
      reject(e);
    };
    function cleanup() {
      clearTimeout(t);
      emitter.off(event, onOk);
      emitter.off("error", onErr);
    }
    emitter.on(event, onOk);
    emitter.on("error", onErr);
  });
}

async function httpGetTextViaHttpProxy({ proxyHost, proxyPort, targetUrl, timeoutMs }) {
  const u = new URL(targetUrl);
  if (u.protocol !== "http:") throw new Error("only_http_supported");
  const host = u.hostname;
  const path = `${u.pathname || "/"}${u.search || ""}`;

  const sock = net.connect({ host: proxyHost, port: proxyPort });
  sock.setNoDelay(true);
  await waitEvent(sock, "connect", timeoutMs);

  // 直接对代理发绝对 URL 的 GET
  sock.write(
    `GET ${u.toString()} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: ip-clash-speedtool\r\nAccept: */*\r\nConnection: close\r\n\r\n`
  );

  const headBuf = await readUntil(sock, (b) => indexOfHeaderEnd(b), timeoutMs);
  const chunks = [headBuf];

  const all = await new Promise((resolve) => {
    let finished = false;
    const t = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { sock.destroy(); } catch {}
      resolve(Buffer.concat(chunks));
    }, timeoutMs);
    sock.on("data", (d) => chunks.push(d));
    sock.on("end", () => {
      if (finished) return;
      finished = true;
      clearTimeout(t);
      resolve(Buffer.concat(chunks));
    });
    sock.on("error", () => {
      if (finished) return;
      finished = true;
      clearTimeout(t);
      resolve(Buffer.concat(chunks));
    });
  });

  const { code, body } = parseHttpResponse(all);
  if (code < 200 || code >= 300) throw new Error(`upstream_http_${code}`);
  return body.toString("utf8").trim();
}

async function httpsGetTextViaHttpProxy({ proxyHost, proxyPort, targetUrl, timeoutMs }) {
  const u = new URL(targetUrl);
  if (u.protocol !== "https:") throw new Error("only_https_supported");
  const host = u.hostname;
  const port = Number(u.port || 443);
  const path = `${u.pathname || "/"}${u.search || ""}`;

  const sock = net.connect({ host: proxyHost, port: proxyPort });
  sock.setNoDelay(true);
  await waitEvent(sock, "connect", timeoutMs);

  // 1) CONNECT
  sock.write(
    `CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\nProxy-Connection: keep-alive\r\nConnection: keep-alive\r\n\r\n`
  );
  const connectResp = await readUntil(sock, (b) => b.indexOf("\r\n\r\n"), timeoutMs);
  const headEnd = indexOfHeaderEnd(connectResp);
  const head = connectResp.slice(0, headEnd).toString("utf8");
  if (!/^HTTP\/1\.[01]\s+200/i.test(head)) {
    sock.destroy();
    throw new Error(`proxy_connect_failed: ${head.split("\r\n")[0] || head}`);
  }

  // 2) TLS over tunnel
  const tlsSock = tls.connect({ socket: sock, servername: host });
  tlsSock.setNoDelay(true);
  // 关键：必须等待 secureConnect，并捕获 early error，避免 Unhandled 'error'
  await waitEvent(tlsSock, "secureConnect", timeoutMs);

  // 3) HTTPS GET
  tlsSock.write(
    `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: ip-clash-speedtool\r\nAccept: */*\r\nConnection: close\r\n\r\n`
  );
  const resp = await readUntil(
    tlsSock,
    (b) => {
      const end = indexOfHeaderEnd(b);
      if (end < 0) return -1;
      // 简化：等 socket close 前可能分多段，这里不强行等待 Content-Length，直接返回由调用方解析
      return end;
    },
    timeoutMs
  );

  // 读取剩余数据直到 close 或超时
  const bodyBuf = await new Promise((resolve) => {
    const chunks = [resp];
    let finished = false;
    const t = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { tlsSock.destroy(); } catch {}
      resolve(Buffer.concat(chunks));
    }, timeoutMs);
    tlsSock.on("data", (d) => chunks.push(d));
    tlsSock.on("end", () => {
      if (finished) return;
      finished = true;
      clearTimeout(t);
      resolve(Buffer.concat(chunks));
    });
    tlsSock.on("error", () => {
      if (finished) return;
      finished = true;
      clearTimeout(t);
      resolve(Buffer.concat(chunks));
    });
  });

  try {
    tlsSock.destroy();
  } catch {}

  const { code, body } = parseHttpResponse(bodyBuf);
  if (code < 200 || code >= 300) throw new Error(`upstream_http_${code}`);
  return body.toString("utf8").trim();
}

function extractIpFromText(s) {
  const m = String(s || "").match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
  return m ? m[1] : null;
}

function extractIpFromJsonText(s) {
  try {
    const j = JSON.parse(String(s || ""));
    const ip = j && (j.ip || j.query);
    return typeof ip === "string" ? ip.trim() : null;
  } catch {
    return null;
  }
}

async function getExitIpViaLocalProxy(cfg) {
  const providers = Array.isArray(cfg.exitIpProviders) && cfg.exitIpProviders.length > 0
    ? cfg.exitIpProviders
    : ["http://icanhazip.com/", "http://ip-api.com/json/?fields=query", "https://api.ipify.org?format=json"];

  for (const p of providers) {
    try {
      const u = new URL(p);
      let text;
      if (u.protocol === "http:") {
        text = await httpGetTextViaHttpProxy({
          proxyHost: "127.0.0.1",
          proxyPort: Number(cfg.mihomo.mixedPort),
          targetUrl: p,
          timeoutMs: 10000
        });
      } else if (u.protocol === "https:") {
        text = await httpsGetTextViaHttpProxy({
          proxyHost: "127.0.0.1",
          proxyPort: Number(cfg.mihomo.mixedPort),
          targetUrl: p,
          timeoutMs: 10000
        });
      } else {
        continue;
      }

      // provider 可能返回纯文本或 JSON
      const ip = extractIpFromJsonText(text) || extractIpFromText(text);
      if (ip) return ip;
    } catch {
      // 尝试下一个 provider
    }
  }
  return null;
}

module.exports = { getExitIpViaLocalProxy };

