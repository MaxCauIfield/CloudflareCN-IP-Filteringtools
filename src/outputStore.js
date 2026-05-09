const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_OUTPUT_FILENAME = "Output.txt";

function keyOfLine(line) {
  const m = String(line).match(/^(\d+\.\d+\.\d+\.\d+:\d+)#/);
  return m ? m[1] : null;
}

/**
 * 将新结果合并进历史：相同 IP:端口 只保留最新一行；保留其它历史行的相对顺序，新出现的键追加在末尾。
 */
function mergeLinesDedupe(existingText, newLines) {
  const ordered = [];
  const indexByKey = new Map();

  for (const line of String(existingText || "").split("\n")) {
    if (!line.trim()) continue;
    const k = keyOfLine(line);
    if (!k) continue;
    if (!indexByKey.has(k)) {
      indexByKey.set(k, ordered.length);
      ordered.push(line);
    } else {
      ordered[indexByKey.get(k)] = line;
    }
  }

  for (const line of newLines || []) {
    if (!line || !String(line).trim()) continue;
    const k = keyOfLine(line);
    if (!k) continue;
    if (indexByKey.has(k)) {
      ordered[indexByKey.get(k)] = line;
    } else {
      indexByKey.set(k, ordered.length);
      ordered.push(line);
    }
  }

  if (ordered.length === 0) return "";
  return `${ordered.join("\n")}\n`;
}

async function mergeOutputDedupe(cwd, newLines, filename = DEFAULT_OUTPUT_FILENAME) {
  const p = path.resolve(cwd, filename);
  let existing = "";
  try {
    existing = await fs.readFile(p, "utf8");
  } catch {
    existing = "";
  }
  const merged = mergeLinesDedupe(existing, newLines);
  await fs.writeFile(p, merged, "utf8");
}

module.exports = { mergeOutputDedupe, mergeLinesDedupe, DEFAULT_OUTPUT_FILENAME };
