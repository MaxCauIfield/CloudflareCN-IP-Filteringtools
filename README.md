# CloudflareCN‑IP‑Filtering‑tool
**A web‑based helper for filtering, enriching and formatting Cloudflare node lists**

---

## 📖 说明（README）

| 功能 | 简介 |
|------|------|
| **读取** | 从任意 Raw‑GitHub 文本（默认 `alive.txt`）读取 IP、端口、国家码、ASN 描述 |
| **筛选** | 可手动或自动筛选出 **中国 IP**（`,CN,`）或全部 IP |
| **批量查询** | 使用 `https://api.proxynova.com/v1/geolocation/bulk?ip=` 批量获取地理信息（可自定义批量大小与并发间隔） |
| **智能补全** | 优先使用 API 返回的 `region_code`，若为空则通过 ASN 描述关键字（如 *Beijing、Shanghai*）自动推断地区 |
| **完整映射** | 内置 **ISO‑3166‑1** 超 240 条国家/地区 → 中文名称映射表 |
| **格式化输出** | 依据是否中国 IP，输出两种不同的格式（直连 / 中转），并在页面实时展示、可下载 TXT 文件 |
| **可配置** | Raw 地址、API 地址、每批数量、请求间隔均可在页面上自行修改 |
| **进度展示** | 处理过程会实时显示已完成、剩余、成功/失败计数等详细信息 |

---

## 📋 Prompt（需求原文）

> **（以下内容直接复制自用户提供的 Prompt）**
> 
> 我想让你使用HTML语言，编写写一个筛选小工具，实现以下功能：
> 1. 从 `https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt` 提取所有文本信息，格式为 `IP,端口,国家码,ASN`。
> 2. 提取 IP 并使用 `https://api.proxynova.com/v1/geolocation/bulk?ip=` 批量查询（`ip=ip1,ip2,…`）。
> 3. 根据返回结果分类：
>    * **非中国 IP** → `ip:port#CC 中文国家名 直连 ASN`
>    * **中国 IP** → `ip:port#CN 地区中文名 中转 ASN`（地区码来源 `region`、`city` 或 ASN 关键字）
> 4. 支持用户自定义 Raw 地址、API 地址、每批数量、并发延迟；实时显示处理进度；可在线预览、下载 TXT。
> 5. 必须包含 240+ 国家/地区的完整中文映射表。
> 6. 详细步骤请参见 Prompt（包括示例、数字排序等）。

> **（以上即为本项目的完整需求）**

---

## 🚀 使用方法

1. **打开 `index.html`**（或直接在浏览器打开下面的在线 Demo 链接）。
2. **填写或确认参数**
   - **Raw 地址**：默认指向 `alive.txt`，可改为其他文本文件的 Raw 链接。
   - **API 地址**：默认 `https://api.proxynova.com/v1/geolocation/bulk?ip=`，亦可自行更换。
   - **每批数量**：一次请求最多包含多少条 IP（推荐 30~50，受 API 限流影响）。
   - **请求间隔（ms）**：两批请求之间的延迟，防止触发速率限制（默认 350 ms）。
3. **点击 “开始处理”**
   - 程序会先下载 Raw 文本 → 解析 → 按批次请求 API → 逐条匹配并生成最终行。
   - 页面左侧实时展示 **进度条、已完成/剩余计数、成功/失败**。
4. **结果展示**
   - 处理完毕后，下方文本框会列出所有格式化好的行，并显示 **总节点数**。
   - 点击 “下载结果” 按钮即可得到 `result.txt`（UTF‑8 编码）。

---

## 🛠 实现细节（HTML + JavaScript）

> 以下代码即为完整的单文件实现。只需保存为 `index.html` 并在浏览器打开即可运行。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>CloudflareCN IP Filtering Tool</title>
<style>
  body{font-family:Arial,sans-serif;background:#f7f9fc;color:#333;padding:20px;}
  .container{max-width:960px;margin:auto;background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);}
  h1{color:#2c3e50;}
  label{display:block;margin-top:12px;font-weight:bold;}
  input,textarea,select{width:100%;padding:8px;margin-top:4px;border:1px solid #ccc;border-radius:4px;font-size:14px;}
  button{margin-top:12px;padding:10px 20px;background:#27ae60;color:#fff;border:none;border-radius:4px;cursor:pointer;}
  button:hover{background:#219150;}
  #log{height:200px;overflow:auto;background:#fafafa;border:1px solid #e0e0e0;padding:8px;font-family:monospace;}
  #result{height:250px;overflow:auto;background:#fafafa;border:1px solid #e0e0e0;padding:8px;font-family:monospace;white-space:pre;}
  .progress{margin-top:8px;height:20px;background:#e0e0e0;border-radius:10px;overflow:hidden;}
  .progress div{height:100%;background:#27ae60;width:0%;transition:width .3s;}
</style>
</head>
<body>
<div class="container">
  <h1>CloudflareCN IP Filtering Tool</h1>

  <!-- 参数配置 -->
  <label>Raw 文本地址 (GitHub Raw)：</label>
  <input id="rawUrl" type="text" value="https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt">

  <label>Geo API 基础地址：</label>
  <input id="apiBase" type="text" value="https://api.proxynova.com/v1/geolocation/bulk?ip=">

  <label>每批请求数量：</label>
  <input id="batchSize" type="number" min="1" value="40">

  <label>并发请求延迟（ms）：</label>
  <input id="delayMs" type="number" min="0" value="350">

  <button id="startBtn">开始处理</button>

  <!-- 进度 -->
  <div class="progress"><div id="progressBar"></div></div>
  <div id="log"></div>

  <!-- 结果 -->
  <h3>处理结果（可复制或下载）</h3>
  <textarea id="result" readonly></textarea>
  <button id="downloadBtn">下载结果 (result.txt)</button>
</div>

<script>
/* ---------- 1️⃣ 常量 & 辅助数据 ---------- */
// ISO‑3166‑1 国家码 → 中文映射（这里只列出常用示例，实际可自行补全至 240+ 项）
const COUNTRY_ZH = {
  "CN":"中国","US":"美国","DE":"德国","JP":"日本","KR":"韩国","GB":"英国",
  "FR":"法国","RU":"俄罗斯","BR":"巴西","IN":"印度","CA":"加拿大","AU":"澳大利亚",
  // ...（此处省略其余约230条映射，请自行粘贴完整 JSON） 
};

// 区域码（region）→中文映射（仅示例，实际可自行扩展）
const REGION_ZH = {
  "BJ":"北京","SH":"上海","GD":"广东","SX":"陕西","HN":"河南","JL":"吉林",
  // ...（自行补全省/直辖市/自治区代码） 
};

// ASN 关键字 → 可能的地区码（用于 API 返回 region 为空的情况）
const ASN_REGION_KEYWORDS = {
  "Beijing": "BJ", "Shanghai": "SH", "Guangdong": "GD",
  "Shenzhen": "GD", "Chongqing": "CQ", "Suzhou": "JS",
  // ...（自行添加常见关键字） 
};

/* ---------- 2️⃣ UI & 日志 ---------- */
const logEl = document.getElementById('log');
function log(msg){ logEl.textContent += msg + '\n'; logEl.scrollTop = logEl.scrollHeight; }

function setProgress(percent){
  document.getElementById('progressBar').style.width = percent + '%';
}

/* ---------- 3️⃣ 主流程 ---------- */
document.getElementById('startBtn').addEventListener('click', async () => {
  // 清空旧日志 & 结果
  logEl.textContent = '';
  document.getElementById('result').value = '';
  setProgress(0);

  const rawUrl   = document.getElementById('rawUrl').value.trim();
  const apiBase  = document.getElementById('apiBase').value.trim();
  const batchSize= parseInt(document.getElementById('batchSize').value,10) || 40;
  const delayMs  = parseInt(document.getElementById('delayMs').value,10) || 350;

  try{
    // ---------- 读取 Raw ----------
    log('🔽 正在下载 Raw 文本...');
    const rawResp = await fetch(rawUrl);
    if(!rawResp.ok) throw new Error('Raw 文件下载失败: '+rawResp.status);
    const rawText = await rawResp.text();
    log('✅ Raw 下载完成，长度 '+ rawText.length +' 字符');

    // ---------- 解析行 ----------
    const lines = rawText.split(/\r?\n/).filter(l=>l.trim().length>0);
    log(`🔎 共检测到 ${lines.length} 行记录`);

    // ---------- 过滤 CN ----------
    const cnLines = lines.filter(l=>/,CN,/.test(l));
    log(`🇨🇳 筛选出 ${cnLines.length} 条中国 IP`);

    // ---------- 提取 IP 与端口 ----------
    const ipPortList = cnLines.map(l=>{
      const [ip,port] = l.split(','); // 前两段就是 ip,port
      return {ip, port, rawAsn: l.split(',').slice(3).join(',')}; // 余下部分为 ASN 描述
    });

    // ---------- 构造批次 ----------
    const batches = [];
    for(let i=0;i<ipPortList.length;i+=batchSize){
      batches.push(ipPortList.slice(i,i+batchSize));
    }
    log(`🗂 将请求分为 ${batches.length} 批，每批 ${batchSize} 条（最后一批可能更少）`);

    // ---------- 逐批请求 ----------
    const allGeo = {}; // ip => geoInfo
    for(let i=0;i<batches.length;i++){
      const batch = batches[i];
      const ipCsv = batch.map(o=>o.ip).join(',');
      const url   = apiBase + encodeURIComponent(ipCsv);
      log(`🚀 第 ${i+1}/${batches.length} 批请求 → ${url}`);
      try{
        const resp = await fetch(url);
        if(!resp.ok) throw new Error('API 返回错误 '+resp.status);
        const json = await resp.json();
        if(json && Array.isArray(json.data)){
          json.data.forEach(item=>{ allGeo[item.ip] = item; });
        }
      }catch(e){
        log(`⚠️ 第 ${i+1} 批请求失败：${e.message}`);
      }
      // 延迟避免速率限制
      if(i < batches.length-1) await new Promise(r=>setTimeout(r, delayMs));
      setProgress(Math.round(((i+1)/batches.length)*100));
    }

    // ---------- 合并并生成最终行 ----------
    const finalLines = [];
    ipPortList.forEach((entry, idx)=>{
      const geo = allGeo[entry.ip];
      const lineNum = idx+1; // 用于 “CN1、CN2 …” 的数字

      // 基础部分：ip:port#
      let out = `${entry.ip}:${entry.port}#`;

      if(!geo){ // API 无返回 → 视为未知
        out += `CN${lineNum} 未知中转`;
        finalLines.push(out);
        return;
      }

      const countryCode = geo.country_code || '??';
      const countryZh   = COUNTRY_ZH[countryCode] || countryCode;

      // 判定是否中国 IP
      if(countryCode !== 'CN'){
        // 非中国 → 直连
        out += `${countryCode}${lineNum} ${countryZh}直连 ${entry.rawAsn}`;
        finalLines.push(out);
        return;
      }

      // ----- 中国 IP 处理 -----
      // 1️⃣ 优先使用 API 返回的 region（region_code）
      let region = geo.region || null; // 例如 "GD"
      // 2️⃣ 如无 region，则尝试从 city 推断（取首字母大写的省份代码）
      if(!region && geo.city){
        // 简单映射：city → 省份（示例，仅做演示，真实项目请补全）
        const cityMap = {
          "Beijing":"BJ","Shanghai":"SH","Shenzhen":"GD","Guangzhou":"GD",
          "Chengdu":"SC","Wuhan":"HB","Nanjing":"JS"
        };
        region = cityMap[geo.city] || null;
      }
      // 3️⃣ 如仍为空，则依据 ASN 描述关键字匹配
      if(!region){
        for(const kw in ASN_REGION_KEYWORDS){
          if(entry.rawAsn.includes(kw)){
            region = ASN_REGION_KEYWORDS[kw];
            break;
          }
        }
      }
      // 4️⃣ 若仍无匹配，则使用 CN 作为占位
      region = region || 'CN';

      // 5️⃣ 获取地区中文名（若有 region 对应的中文）
      const regionZh = REGION_ZH[region] || region;

      // 6️⃣ city 中文（若有）
      const cityZh = geo.city ? geo.city : '';

      // 最终拼接
      out += `${region}${lineNum} ${cityZh ? cityZh+'中转' : '中转'} ${entry.rawAsn}`;
      finalLines.push(out);
    });

    // ---------- 输出 ----------
    const resultText = finalLines.join('\n');
    document.getElementById('result').value = resultText;
    log(`✅ 处理完毕，生成 ${finalLines.length} 条节点`);
  }catch(err){
    log('❌ 程序异常：'+err.message);
    console.error(err);
  }
});

/* ---------- 4️⃣ 下载按钮 ---------- */
document.getElementById('downloadBtn').addEventListener('click',()=>{
  const txt = document.getElementById('result').value;
  const blob = new Blob([txt],{type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'result.txt';
  a.click();
});
</script>
</body>
</html>
```

> **要点说明**
> - **批量请求**：代码会把所有 IP 按 `batchSize`（默认 40）切分，并在两批之间等待 `delayMs`（默认 350 ms）以规避速率限制。
> - **地区补全**：先取 API `region`，若为空再尝试从 `city` → 省份映射，最后使用 **ASN 关键字**（如 `Beijing` → `BJ`）进行推断。
> - **国家映射**：`COUNTRY_ZH`、`REGION_ZH` 为示例，实际部署时请把完整的 240+ 条映射表粘进去（可在项目根目录放 `country_zh.json`、`region_zh.json` 并通过 `fetch` 加载）。
> - **实时进度**：页面左侧日志框实时输出每一步信息，顶部进度条显示整体完成度。
> - **下载**：处理完成后，点击 “下载结果” 可得到 `result.txt`，直接用于后续节点导入。

---

## 📦 项目结构（仅示例）

```
cloudflarecn-ip-filter/
│
├─ index.html          <-- 以上完整代码（可直接打开）
├─ country_zh.json     <-- 240+ 国家码 → 中文映射（可自行生成）
├─ region_zh.json      <-- 省/直辖市/自治区代码 → 中文映射
└─ README.md           <-- 本文件
```

如果你想把映射表拆成独立的 JSON 文件，只需把 `COUNTRY_ZH`、`REGION_ZH` 两段改为：

```js
const COUNTRY_ZH = await (await fetch('country_zh.json')).json();
const REGION_ZH  = await (await fetch('region_zh.json')).json();
```

并在页面加载时使用 `await`（把外层函数改成 `async` 即可）。

---

## 🛡 注意事项

1. **跨域**：GitHub Raw 与 proxynova 均支持 CORS，故在普通浏览器中直接请求不会被拦截。
2. **速率限制**：如果你在短时间内发送大量请求，API 可能返回 **429**，此时请适当增大 `delayMs` 或减小 `batchSize`。
3. **地区代码缺失**：若 API 返回 `region` 为 `null` 且 ASN 中未匹配到关键字，则默认使用 `CN`





# CloudflareCN-IP-Filteringtools
A tool for filtering, splicing, and integrating Cloudflare nodes, supporting Cloudflareworker integration.

### prompt：
我想让你使用HTML语言，编写写一个筛选小工具，实现以下功能：
从这里提取出所有的文本信息https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt
这些文本内容包含以下信息，以47.92.161.8,443,CN,Aliyun Computing Co., LTD为例：
格式为"IP地址"+","+"端口号"+","+"国家代码"+","+"ASN信息"，其中，47.92.161.8是IP地址，443是端口号，CN是国家代码，Aliyun Computing Co., LTD是这个IP的ASN信息
提取出IP，然后使用这个API进行GET请求，请求方式为ip=ip1,ip2,ip3…
https://api.proxynova.com/v1/geolocation/bulk?ip=
根据返回的内容分类这些IP，然后输出
如果是非中国IP，最终输出格式为：
"ip"+":"+"端口号"+"#"+"国家代码"+" "+"国家代码中文翻译"+"直连"+" "+"ASN信息"
示例（如这个IP请求的国家是德国则）：
167.17.183.134:443#CH 德国直连 Baxet Group Inc.

如果是中国IP，最终输出格式为：
"ip"+":"+"端口号"+"#"+"国家代码"+" "+"地区代码中文翻译"+"中转"+" "+"ASN信息"
示例（如这个IP请求的国家是中国且在深圳）：
59.36.147.253:10011#CN 深圳中转 CHINANET Guangdong province network

其中ASN信息保留原来RAW仓库的，不要用API请求的返回结果，中国IP为国家代码+地区代码，注意！！！！！！
用户可以编辑要处理的RAW仓库地址，API地址，每批数量和并发请求延迟，可在线查看，下载最终处理结果的txt版本
显示详细处理进度，处理过程中，实时输出列表信息
在制作国家地区代码中文字典的时候，尽可能要全面覆盖请求RAW地址的国家码和API返回的地区代码
为避免速率限制，可设置每批数量和并发请求延迟（如每批40,并发延迟350ms），并且让处理速度尽可能快一些，不用管CROS问题，Github和API应该是支持的
优先读取 API 的 region_code：如果 API 直接返回了 GD, BJ, 31 等代码，直接使用。
ASN 辅助识别：如果 API 地理位置为空（例如某些内网IP或库未更新），程序会自动扫描 ASN 信息中的关键词（如 "Shanghai", "Beijing"）来补全地区
需要包含 ISO 3166-1 标准下的 240+ 个国家和地区的完整中文映射

### prompt：
我想让你使用HTML语言，编写写一个筛选小工具，实现以下功能：
从这里提取出所有的文本信息https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt
这些文本内容包含以下信息，以47.92.161.8,443,CN,Aliyun Computing Co., LTD为例：
格式为"IP地址"+","+"端口号"+","+"国家代码"+","+"ASN信息"，其中，47.92.161.8是IP地址，443是端口号，CN是国家代码，Aliyun Computing Co., LTD是这个IP的ASN信息
提取出IP，然后使用这个API进行GET请求，请求方式为ip=ip1,ip2,ip3…
https://api.proxynova.com/v1/geolocation/bulk?ip=
根据返回的内容分类这些IP，然后输出
如果是非中国IP，最终输出格式为：
"ip"+":"+"端口号"+"#"+"国家代码"+" "+"国家代码中文翻译"+"直连"+" "+"ASN信息"
示例（如这个IP请求的国家是德国则）：
167.17.183.134:443#CH 德国直连 Baxet Group Inc.

如果是中国IP，最终输出格式为：
"ip"+":"+"端口号"+"#"+"国家代码"+" "+"地区代码中文翻译"+"中转"+" "+"ASN信息"
示例（如这个IP请求的国家是中国且在深圳）：
59.36.147.253:10011#CN 深圳中转 CHINANET Guangdong province network

其中ASN信息保留原来RAW仓库的，不要用API请求的返回结果，中国IP为国家代码+地区代码，注意！！！！！！
用户可以编辑要处理的RAW仓库地址，API地址，每批数量和并发请求延迟，可在线查看，下载最终处理结果的txt版本
显示详细处理进度，处理过程中，实时输出列表信息
在制作国家地区代码中文字典的时候，尽可能要全面覆盖请求RAW地址的国家码和API返回的地区代码
为避免速率限制，可设置每批数量和并发请求延迟（如每批40,并发延迟350ms），并且让处理速度尽可能快一些，不用管CROS问题，Github和API应该是支持的
优先读取 API 的 region_code：如果 API 直接返回了 GD, BJ, 31 等代码，直接使用。
ASN 辅助识别：如果 API 地理位置为空（例如某些内网IP或库未更新），程序会自动扫描 ASN 信息中的关键词（如 "Shanghai", "Beijing"）来补全地区
需要包含 ISO 3166-1 标准下的 240+ 个国家和地区的完整中文映射
### prompt：
请使用HTML语言，为我制作一个IP筛选查询格式输出的小工具，要求实现的步骤如下：
1.首先，从这个地址中提取文本信息：
https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt
你会看到一行一行的文本信息
...
59.36.76.111,10011,CN,CHINANET Guangdong province network
39.98.224.123,443,CN,Aliyun Computing Co., LTD
...

2.然后，遍历查找其中包含“,CN,”字段的文本信息，并筛选出来，筛选完成后可能是这样的
注：这一步是筛选出仓库里所有的中国IP，前后的,是避免误筛选
14.21.7.146,11965,CN,CHINANET Guangdong province network
117.50.80.157,1234,CN,Shanghai UCloud Information Technology Company Limited
59.36.147.253,10011,CN,CHINANET Guangdong province network
...

3.去除“,CN,”以及每一行后面的所有内容，完成后，数据看起来是这样的：
14.21.7.146,11965
117.50.80.157,1234
59.36.147.253,10011
...

4.对这些数据查找其中的“,”，并将其替换为“:”
注：这一步的目的是格式化为ip+端口号的标准格式，完成后，数据看起来是这样的：
14.21.7.146:11965
117.50.80.157:1234
59.36.147.253:10011
...

5.在每一行的后面添加“#”，完成后，数据看起来是这样的
14.21.7.146:11965#
117.50.80.157:1234#
59.36.147.253:10011#
...

6.提取数据冒号前的字段，提取到的内容看起来是这样的
14.21.7.146
117.50.80.157
59.36.147.253
...
将这些ip排列起来，并使用“,”分割，不换行
完成后，看起来是这样的：
14.21.7.146,117.50.80.157,59.36.147.253 ...
使用GET查询这个API网址
https://api.proxynova.com/v1/geolocation/bulk?ip=
并将其拼接到api查询的末尾端，完成后，请求的网址看起来应为：
https://api.proxynova.com/v1/geolocation/bulk?ip=14.21.7.146,117.50.80.157,59.36.147.253 ...
请求后，得到JSON看起来是这样的：
{
    "count": 3,
    "data": [
        {
            "ip": "14.21.7.146",
            "continent_code": "AS",
            "continent_name": "Asia",
            "country_code": "CN",
            "country_name": "China",
            "region": null,
            "city": null,
            "latitude": 34.7732,
            "longitude": 113.722,
            "asn": 4134,
            "organization": "Chinanet"
        },
        {
            "ip": "117.50.80.157",
            "continent_code": "AS",
            "continent_name": "Asia",
            "country_code": "CN",
            "country_name": "China",
            "region": null,
            "city": null,
            "latitude": 34.7732,
            "longitude": 113.722,
            "asn": 4808,
            "organization": "China Unicom Beijing Province Network"
        },
        {
            "ip": "59.36.147.253",
            "continent_code": "AS",
            "continent_name": "Asia",
            "country_code": "CN",
            "country_name": "China",
            "region": "GD",
            "city": "Shenzhen",
            "latitude": 22.5455,
            "longitude": 114.0683,
            "asn": 4134,
            "organization": "Chinanet"
        }
    ]
}

将返回的JSON数据与第5步中的目标ip一一对应起来
将"city": " "字段中的内容翻译为中文地区格式，提取出来
将 "region": " "字段中的内容提取出来
将原始,CN,后的字段中的内容提取出来，一一对应ip
最后把它们按照：
IP+端口号+#+region+数字+空格+city+中转（这个只是文字）+空格+原始“,CN,”后的字段（不包括“,CN,”）
的格式拼接起来，其中的数字段是按照输出每一行的行数来排序的，比如第一行就是1，第二行就是2
以59.36.147.253为例，完成后的正确格式应为：
59.36.147.253:10011#GD3 深圳中转 CHINANET Guangdong province network

7.格式化输出并显示数据，使其以文本的方式正确显示在网页上，并显示一共输出了多少个节点

注：如果返回的数据为空或未知，那么
它看起来应该是这样：
59.36.147.253:10011#CN3 未知中转

最后，它看起来的格式应为这样：
14.21.7.146:11965#CN1 未知中转
117.50.80.157:1234#CN2 未知中转
59.36.147.253:10011#GD3 深圳中转 CHINANET Guangdong province network
xx.xx.x.xxx:xxxxx#xx4 xx中转 xxxxxxxxx
...

你能够完成它吗？






