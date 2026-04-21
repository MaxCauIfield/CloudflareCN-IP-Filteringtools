function yq(s) {
  const str = String(s);
  const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function indent(n) {
  return " ".repeat(n);
}

/**
 * proxies: [{name, server, port}]
 */
function buildMihomoConfigYaml(cfg, proxies) {
  const tpl = cfg.nodeTemplate;
  const secret = String(cfg.mihomo.secret || "");

  const proxyList = proxies.map((p) => {
    return {
      name: `IP ${p.server}:${p.port}`,
      server: p.server,
      port: p.port
    };
  });

  const echEnable = Boolean(tpl.ech?.enable);
  const echQuery = tpl.ech?.queryServerName || "cloudflare-ech.com";
  const wsPath = tpl.ws?.path || "/";
  const wsHostHeader = tpl.ws?.headers?.Host || tpl.ws?.headers?.host || tpl.sni;

  const lines = [];
  lines.push(`mixed-port: ${Number(cfg.mihomo.mixedPort)}`);
  lines.push(`allow-lan: false`);
  lines.push(`mode: global`);
  lines.push(`log-level: info`);
  lines.push(`external-controller: ${yq(cfg.mihomo.externalController)}`);
  lines.push(`secret: ${yq(secret)}`);
  lines.push(`proxies:`);
  for (const p of proxyList) {
    lines.push(`${indent(2)}- name: ${yq(p.name)}`);
    lines.push(`${indent(4)}type: ${yq(tpl.type)}`);
    lines.push(`${indent(4)}server: ${yq(p.server)}`);
    lines.push(`${indent(4)}port: ${Number(p.port)}`);
    lines.push(`${indent(4)}password: ${yq(tpl.password)}`);
    lines.push(`${indent(4)}network: ${yq(tpl.network)}`);
    lines.push(`${indent(4)}sni: ${yq(tpl.sni)}`);
    lines.push(`${indent(4)}skip-cert-verify: ${tpl.skipCertVerify ? "true" : "false"}`);
    lines.push(`${indent(4)}ech-opts:`);
    lines.push(`${indent(6)}enable: ${echEnable ? "true" : "false"}`);
    lines.push(`${indent(6)}query-server-name: ${yq(echQuery)}`);
    lines.push(`${indent(4)}ws-opts:`);
    lines.push(`${indent(6)}path: ${yq(wsPath)}`);
    lines.push(`${indent(6)}headers:`);
    lines.push(`${indent(8)}Host: ${yq(wsHostHeader)}`);
  }

  lines.push(`proxy-groups:`);
  lines.push(`${indent(2)}- name: ${yq("GLOBAL")}`);
  lines.push(`${indent(4)}type: select`);
  lines.push(`${indent(4)}proxies:`);
  for (const name of proxyList.map((p) => p.name)) {
    lines.push(`${indent(6)}- ${yq(name)}`);
  }

  lines.push(`rules:`);
  lines.push(`${indent(2)}- MATCH,GLOBAL`);

  return `${lines.join("\n")}\n`;
}

module.exports = { buildMihomoConfigYaml };

