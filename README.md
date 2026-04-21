
# CloudflareCN-IP-Filteringtools

A web tool for filtering, splicing, and integrating Cloudflare nodes, with support for Cloudflare Worker integration. The tool extracts an IP list from a specified RAW data source, performs batch geolocation API queries, and outputs formatted results categorized by country code, making it easy to use directly in proxy rule configurations.

---

## ✨ Features

- 📥 **Flexible data source**: Extract IP data from any RAW repository URL (default format: `IP,port,country code,ASN info`)
- 🌍 **Batch geolocation**: Call the [ProxyNova](https://api.proxynova.com/) geolocation API to batch‑query IP details
- 🇨🇳 **Smart categorized output**:
  - **China IPs**: Output format `IP:Port#<region code><index> <city/region in Chinese> Transit <original ASN>`
  - **Non‑China IPs**: Output format `IP:Port#<country code> <country in Chinese> Direct <original ASN>` (*Note: Designed per requirements; the actual tool can focus on China IPs*)
- 🔄 **Preserve original ASN**: ASN information always uses the fourth field from the original data, not the `organization` returned by the API
- 📍 **Intelligent region completion**:
  - Prefer the `region_code` returned by the API (e.g., `GD`, `BJ`, `31`, etc.)
  - If `region_code` is empty, automatically scan the original ASN field for keywords (e.g., `Shanghai`, `Beijing`) to infer the region
- 🗺️ **Complete mapping table**: Built‑in ISO 3166‑1 standard mapping for 240+ countries/regions to Chinese names, plus province/city codes for China
- ⚙️ **Configurable parameters**: RAW data source, API endpoint, batch size, concurrency delay (default 40/350 ms)
- 📊 **Real‑time progress**: Shows current batch, progress percentage, success/failure counts, live logs during processing
- 📋 **Online preview**: View the formatted node list in real time
- 💾 **One‑click download**: Save the final result as a `.txt` file
- 🚀 **Efficient and stable**: Uses batch processing and delay control to avoid rate limits, optimizing speed

---

## 🚀 Quick Start

1. Download or clone this repository  
2. Open the `index.html` file directly in a browser  
3. Adjust configuration parameters as needed (defaults work for most cases)  
4. Click the “Start Processing” button  
5. Wait for completion, then view and download the final list in the result area  

---

## ⚙️ Configuration Parameters

| Parameter | Description | Default |
|------|------|--------|
| **RAW Data URL** | Link to the raw IP data file (each line format: `IP,port,CC,ASN`) | `https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt` |
| **API Endpoint** | Geolocation API address (supports bulk IP, parameter name is `ip`) | `https://api.proxynova.com/v1/geolocation/bulk?ip=` |
| **Batch Size** | Number of IPs sent per batch (recommended 20‑100 to avoid throttling) | `40` |
| **Delay (ms)** | Delay between batches in milliseconds (recommended 300‑1000) | `350` |

---

## 📝 Output Format Details

### China IP (primary output)
```
59.36.147.253:10011#GD3 Shenzhen Transit CHINANET Guangdong province network
```
- `59.36.147.253:10011`: original IP and port  
- `#GD3`:
  - `GD`: region code (from the API’s `region_code`, e.g., `GD` = Guangdong, `BJ` = Beijing, `31` = Shanghai, etc.)
  - `3`: **current output line number** (incrementing from 1)  
- `Shenzhen`: city name in Chinese (translated from the API’s `city` field)  
- `Transit`: fixed label  
- `CHINANET Guangdong province network`: **original ASN information** (kept unchanged)

### Special case (region/city unknown)
```
14.21.7.146:11965#CN1 Unknown Transit CHINANET Guangdong province network
```
- When the API provides no `region_code` and the region cannot be inferred from the ASN, the region code falls back to `CN` (national level)  
- City is shown as `Unknown`

### Non‑China IP (if enabled)
```
167.17.183.134:443#CH Germany Direct Baxet Group Inc.
```
- `#CH`: country code (two‑letter)  
- `Germany`: country name in Chinese (here shown in English for illustration)  
- `Direct`: fixed label  
- `Baxet Group Inc.`: original ASN information  

---

## 🔧 Technical Details

### Data Processing Flow
1. **Download & parse**: `fetch` the RAW URL, split by lines, parse each line into `[IP, port, cc, asn]`.  
2. **Filter China IPs**: Keep only lines containing `,CN,` (to avoid false matches).  
3. **Extract IP list**: From the filtered lines, extract IP and port, format as `IP:Port`, and collect all IPs separated by commas.  
4. **Batch API queries**: Split the IP list into groups according to the configured batch size, request the API once per group, and add a delay between batches.  
5. **Data matching**: Pair the JSON data returned by the API with the original filtered list by IP.  
6. **Format output**:
   - For each China IP:
     - Use the API’s `region_code` as the region code (priority); if empty, try to infer it from keywords in the original `asn` field (e.g., `Shanghai` → `SH`).  
     - Translate the API’s `city` to Chinese (e.g., `Shenzhen` → `深圳`); if empty, show `Unknown`.  
     - Combine region code + global incremental index to form `#<region><index>`.  
     - Append ` <city> Transit <original ASN>`.  
7. **Statistics & download**: Show total node count, provide a text preview, and allow downloading as a `.txt` file.

### Region Mapping Dictionary
- **Country codes**: Based on ISO 3166‑1 (240+ countries/regions) mapped to Chinese names (e.g., `CN` → `中国`, `US` → `美国`, `DE` → `德国`).  
- **China region codes**: Covers common province codes (e.g., `GD` → `广东`, `BJ` → `北京`, `SH` → `上海`, `31` → `上海`), and supports inference from ASN keywords (e.g., `Guangdong` → `GD`).

### ASN Helper Identification Logic
When both `region_code` and `city` from the API are `null`, the program scans the original `asn` field, matches predefined keyword mappings (e.g., `Shanghai` → `SH`, `Beijing` → `BJ`, `Guangdong` → `GD`), and fills in missing region information.

### Rate‑limit Handling
- Controls request frequency via `Batch Size` and `Delay`; default is 40 IPs per batch with a 350 ms pause, balancing speed and stability.  
- Real‑time status and errors (e.g., IP lookup failures) are displayed; failed items are marked `Unknown` and processing continues.

### CORS Note
Assumes the target API (e.g., ProxyNova) and GitHub RAW both support cross‑origin requests; if CORS issues arise, they must be resolved on the API side or via a proxy.

---

## 📋 Original Design Prompt

The tool was built entirely from the following user‑provided prompt, preserving the original requirements:

```text
# CloudflareCN-IP-Filteringtools
A tool for filtering, splicing, and integrating Cloudflare nodes, supporting Cloudflareworker integration.

### prompt：
I want you to use HTML to write a small filtering tool that implements the following functions:
Extract all text information from https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt
These texts contain information like 47.92.161.8,443,CN,Aliyun Computing Co., LTD, formatted as "IP address"+","+"port"+","+"country code"+","+"ASN info". Extract the IP, then perform a GET request to this API using ip=ip1,ip2,ip3…
https://api.proxynova.com/v1/geolocation/bulk?ip=
Classify the IPs based on the response and output them.
If the IP is not from China, the final format should be:
"ip"+":"+"port"+"#"+"country code"+" "+"country name in Chinese"+"Direct"+" "+"ASN info"
Example (if the country is Germany):
167.17.183.134:443#CH Germany Direct Baxet Group Inc.

If the IP is from China, the final format should be:
"ip"+":"+"port"+"#"+"country code"+" "+"region name in Chinese"+"Transit"+" "+"ASN info"
Example (if the IP is from China and the city is Shenzhen):
59.36.147.253:10011#CN Shenzhen Transit CHINANET Guangdong province network

The ASN info must stay as in the original RAW file; do not use the API’s return. For Chinese IPs, use country code + region code—note!!!! Users can edit the RAW repository URL, API URL, batch size, and request delay, view results online, and download the final TXT version.
Show detailed processing progress and output the list in real time.
When building the country/region code dictionary, cover as many country codes and API region codes as possible.
To avoid rate limits, allow setting batch size and request delay (e.g., 40 per batch, 350 ms delay), and make processing as fast as possible—ignore CORS issues; GitHub and the API should support it.
Prioritize the API’s `region_code`: if the API returns codes like GD, BJ, 31, use them directly.
ASN assistance: if the geolocation is empty (e.g., internal IP or outdated DB), scan ASN keywords (e.g., "Shanghai", "Beijing") to supplement the region.
Include a full Chinese mapping for the 240+ ISO 3166‑1 countries/regions.
```

```text
### prompt：
Please use HTML to create a small IP filtering and formatting tool with the following steps:
1. First, extract text from:
https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt
You’ll see line‑by‑line text, e.g.:
...
59.36.76.111,10011,CN,CHINANET Guangdong province network
39.98.224.123,443,CN,Aliyun Computing Co., LTD
...

2. Then, search for lines containing “,CN,” and filter them. After filtering you might have:
14.21.7.146,11965,CN,CHINANET Guangdong province network
117.50.80.157,1234,CN,Shanghai UCloud Information Technology Company Limited
59.36.147.253,10011,CN,CHINANET Guangdong province network
...

3. Remove “,CN,” and everything after it, resulting in:
14.21.7.146,11965
117.50.80.157,1234
59.36.147.253,10011
...

4. Replace the “,” with “:” to get standard ip:port format:
14.21.7.146:11965
117.50.80.157:1234
59.36.147.253:10011
...

5. Append “#” to each line:
14.21.7.146:11965#
117.50.80.157:1234#
59.36.147.253:10011#
...

6. Extract the part before the colon to build a comma‑separated list:
14.21.7.146,117.50.80.157,59.36.147.253...
Append this to the API URL:
https://api.proxynova.com/v1/geolocation/bulk?ip=14.21.7.146,117.50.80.157,59.36.147.253...
The JSON response looks like:
{
    "count": 3,
    "data": [
        { "ip": "14.21.7.146", "continent_code": "AS", "continent_name": "Asia", "country_code": "CN", "country_name": "China", "region": null, "city": null, ... },
        { "ip": "117.50.80.157", "continent_code": "AS", "continent_name": "Asia", "country_code": "CN", "country_name": "China", "region": null, "city": null, ... },
        { "ip": "59.36.147.253", "continent_code": "AS", "continent_name": "Asia", "country_code": "CN", "country_name": "China", "region": "GD", "city": "Shenzhen", ... }
    ]
}
Match the JSON data with the IPs from step 5, translate the “city” field to Chinese, extract the “region” field, and extract the original field after “,CN,” for each IP.
Finally, compose them as:
IP+port+#+region+number+space+city+Transit+space+original ASN (excluding “,CN,”)
The number is the line index (1, 2, 3 …). Example:
59.36.147.253:10011#GD3 Shenzhen Transit CHINANET Guangdong province network

7. Display the formatted output as text on the web page and show the total number of nodes.

If data is empty or unknown it should look like:
59.36.147.253:10011#CN3 Unknown Transit

The final format should be:
14.21.7.146:11965#CN1 Unknown Transit
117.50.80.157:1234#CN2 Unknown Transit
59.36.147.253:10011#GD3 Shenzhen Transit CHINANET Guangdong province network
xx.xx.x.xxx:xxxxx#xx4 xx Transit xxxxxxxxx
...

Can you complete it?
```

---

## 📦 Example

### Input (RAW data snippet)
```
47.92.161.8,443,CN,Aliyun Computing Co., LTD
167.17.183.134,443,DE,Baxet Group Inc.
59.36.147.253,10011,CN,CHINANET Guangdong province network
```

### Processed output (China IPs only)
```
59.36.147.253:10011#GD1 Shenzhen Transit CHINANET Guangdong province network
```
*(Assuming this is the first China IP)*

---

## ⚠️ Notes

- **CORS**: The tool relies on the browser `fetch` API; ensure the target API and RAW URLs support CORS. If a CORS error occurs, use a proxy or adjust API settings.  
- **API limits**: When querying in bulk, respect the API’s rate limits; adjust batch size and delay to avoid being blocked.  
- **Region inference**: The ASN keyword map may be incomplete; complex ASN strings may cause inference failures, in which case the region will show `CN` or `Unknown`.  
- **Data format**: Ensure each line in the RAW file strictly follows `IP,port,CC,ASN` with commas and no extra spaces.  
- **Output order**: The output order follows the filtered original data order; line numbers increase sequentially.

---

## 🙏 Acknowledgments

- Original data source: [Emilia repository](https://github.com/papapapapdelesia/Emilia)  
- Geolocation API: [ProxyNova](https://api.proxynova.com/)

---

## 📄 License

MIT License © 2024


# CloudflareCN-IP-Filteringtools

一个用于筛选、拼接和整合 Cloudflare 节点的 Web 工具，支持 Cloudflare Worker 集成。工具从指定的 RAW 数据源提取 IP 列表，批量查询地理位置 API，并根据国家代码分类输出格式化结果，便于直接用于代理规则配置。

---

## ✨ 功能特性

- 📥 **数据源灵活**：从任意 RAW 仓库 URL 提取 IP 数据（默认格式：`IP,端口,国家代码,ASN信息`）
- 🌍 **批量地理查询**：调用 [ProxyNova](https://api.proxynova.com/) 地理定位 API 批量查询 IP 详情
- 🇨🇳 **智能分类输出**：
  - **中国 IP**：输出格式 `IP:Port#<地区代码><序号> <城市/地区中文> 中转 <原始ASN>`
  - **非中国 IP**：输出格式 `IP:Port#<国家代码> <国家中文> 直连 <原始ASN>`（*注：根据需求设计，实际工具可聚焦中国 IP*）
- 🔄 **保留原始 ASN**：ASN 信息始终使用原始数据第四段，不依赖 API 返回的 `organization`
- 📍 **地区智能补全**：
  - 优先使用 API 返回的 `region_code`（如 `GD`, `BJ`, `31` 等）
  - 若 `region_code` 为空，自动扫描原始 ASN 字段关键词（如 `Shanghai`, `Beijing`）推断地区
- 🗺️ **完整映射表**：内置 ISO 3166-1 标准下 240+ 国家/地区中文映射，以及中国省份/城市代码映射
- ⚙️ **可配置参数**：RAW 数据源、API 端点、每批请求数量、并发延迟（默认 40/350ms）
- 📊 **实时进度**：处理过程中显示当前批次、进度百分比、成功/失败计数、实时日志
- 📋 **在线预览**：实时查看格式化后的节点列表
- 💾 **一键下载**：将最终结果保存为 `.txt` 文件
- 🚀 **高效稳定**：通过批处理和延迟控制避免速率限制，优化处理速度

---

## 🚀 快速开始

1. 下载或克隆本仓库
2. 用浏览器直接打开 `index.html` 文件
3. 根据需要修改配置参数（通常使用默认值即可）
4. 点击“开始处理”按钮
5. 等待处理完成，在结果区域查看并下载最终列表

---

## ⚙️ 配置参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| **RAW Data URL** | 原始 IP 数据文件的 RAW 链接（每行格式：`IP,port,CC,ASN`） | `https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt` |
| **API Endpoint** | 地理查询 API 地址（支持批量 IP，参数名为 `ip`） | `https://api.proxynova.com/v1/geolocation/bulk?ip=` |
| **Batch Size** | 每批发送的 IP 数量（建议 20-100，避免触发限速） | `40` |
| **Delay (ms)** | 每批请求之间的延迟时间（毫秒，建议 300-1000） | `350` |

---

## 📝 输出格式详解

### 中国 IP（主要输出）
```
59.36.147.253:10011#GD3 深圳中转 CHINANET Guangdong province network
```
- `59.36.147.253:10011`：原始 IP 和端口
- `#GD3`：
  - `GD`：地区代码（来自 API 的 `region_code`，如 `GD`=广东, `BJ`=北京, `31`=上海等）
  - `3`：**当前输出行号**（从 1 开始递增）
- `深圳`：城市中文名（来自 API 的 `city` 字段翻译）
- `中转`：固定标记
- `CHINANET Guangdong province network`：**原始数据中的 ASN 信息**（保持不变）

### 特殊情况（地区/城市未知）
```
14.21.7.146:11965#CN1 未知中转 CHINANET Guangdong province network
```
- 当 API 未返回 `region_code` 且无法从 ASN 推断时，地区代码使用 `CN`（代表国家级）
- 城市显示为 `未知`

### 非中国 IP（若启用）
```
167.17.183.134:443#CH 德国直连 Baxet Group Inc.
```
- `#CH`：国家代码（两位字母）
- `德国`：国家中文名
- `直连`：固定标记
- `Baxet Group Inc.`：原始 ASN 信息

---

## 🔧 技术细节

### 数据处理流程
1. **下载与解析**：`fetch` RAW URL，按行拆分，解析每行为 `[IP, port, cc, asn]`。
2. **筛选中国 IP**：仅保留原始数据中包含 `,CN,` 的行（避免误匹配）。
3. **提取 IP 列表**：从筛选后的行中提取 IP 和端口，格式化为 `IP:Port`，并收集所有 IP 用逗号分隔。
4. **批量查询 API**：将 IP 列表按设定批量大小分组，每组请求一次 API，批次间添加延迟。
5. **数据匹配**：将 API 返回的 JSON 数据与原始筛选列表按 IP 一一对应。
6. **格式化输出**：
   - 对于每个中国 IP：
     - 取 API 返回的 `region_code` 作为地区代码（优先），若为空则尝试从原始 `asn` 字段关键词（如 `Shanghai`→`SH`）推断。
     - 取 API 的 `city` 并翻译为中文（如 `Shenzhen`→`深圳`），若为空则显示 `未知`。
     - 地区代码 + 当前输出行号（全局递增）拼接为 `#<region><序号>`。
     - 最后拼接 ` <城市> 中转 <原始ASN>`。
7. **统计与下载**：输出总节点数，提供文本预览和下载功能。

### 地区映射字典
- **国家代码**：基于 ISO 3166-1 标准（240+ 国家/地区），映射为中文（如 `CN`→`中国`, `US`→`美国`, `DE`→`德国`）。
- **中国地区代码**：覆盖常见省份代码（如 `GD`→`广东`, `BJ`→`北京`, `SH`→`上海`, `31`→`上海` 等），并支持从 ASN 关键词推断（如 `Guangdong`→`GD`）。

### ASN 辅助识别逻辑
当 API 返回的 `region_code` 和 `city` 均为 `null` 时，程序将扫描原始 `asn` 字段，匹配预设关键词映射表（如 `Shanghai`→`SH`, `Beijing`→`BJ`, `Guangdong`→`GD`），从而补全地区信息。

### 速率限制处理
- 通过 `Batch Size` 和 `Delay` 参数控制请求频率，默认 40 IP/批、350ms 延迟，平衡速度与稳定性。
- 实时显示请求状态和错误（如 IP 查询失败），失败项将标记为 `未知` 并继续处理。

### CORS 说明
假设目标 API（如 ProxyNova）和 GitHub RAW 均支持跨域请求（CORS），若遇到跨域问题，需在 API 端或通过代理解决。

---

## 📋 原始设计 Prompt

本工具完全根据以下用户提供的 prompt 开发，保留原始需求表述：

```text
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
```

```text
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
```

---

## 📦 示例

### 输入（RAW 数据片段）
```
47.92.161.8,443,CN,Aliyun Computing Co., LTD
167.17.183.134,443,DE,Baxet Group Inc.
59.36.147.253,10011,CN,CHINANET Guangdong province network
```

### 处理后输出（仅中国 IP）
```
59.36.147.253:10011#GD1 深圳中转 CHINANET Guangdong province network
```
（假设此为第一个中国 IP）

---

## ⚠️ 注意事项

- **跨域问题**：工具依赖浏览器 `fetch` API，确保目标 API 和 RAW 地址支持 CORS。如遇跨域错误，需配置代理或调整 API 设置。
- **API 限制**：批量查询时请遵守目标 API 的速率限制，通过调整批处理大小和延迟避免被封禁。
- **地区推断**：ASN 关键词映射表可能不完整，复杂 ASN 字符串可能导致推断失败，此时地区将显示为 `CN` 或 `未知`。
- **数据源格式**：确保 RAW 数据每行严格遵循 `IP,port,CC,ASN` 格式，逗号分隔，无额外空格。
- **输出顺序**：输出顺序与筛选后的原始数据顺序一致，序号按输出行递增。

---

## 🙏 致谢

- 原始数据来源：[Emilia 仓库](https://github.com/papapapapdelesia/Emilia)
- 地理位置 API：[ProxyNova](https://api.proxynova.com/)

---

## 📄 许可证

MIT License © 2024
=======
## IP → Clash 节点测速筛选（Node.js）

### 你会得到什么

- 从 FOFA 复制文本里提取并去重所有 `IP:端口`
- 查询 **节点本身 IP** 的 **城市** 与 **ASN 全称**
- 启动无头 **Mihomo(Clash Meta) 核心**，导入生成的节点并做连通性/延迟测试
- 删除所有 timeout/失败节点，仅保留可用节点
- 对每个可用节点获取 **落地出口 IP**，并查询落地 IP 的国家/地区
- 按指定格式批量输出结果

### 前置条件

- Node.js 18+（建议 20/22）
- Linux 下可执行的 `mihomo`（本工具支持从 GitHub Releases 自动下载；若你的网络需代理/被拦截，请手动下载并配置 `mihomo.binPath`）

### 配置

复制一份配置文件：

```bash
cp config.example.json config.json
```

如需手动指定 mihomo：

- `config.json` 里把 `mihomo.binPath` 指到可执行文件
- 或使用环境变量 `MIHOMO_BIN=/path/to/mihomo`

### 运行（推荐：stdin 直接粘贴 FOFA）

```bash
node bin/ip-clash-speedtool.js --stdin
```

然后把 FOFA 复制的表格内容粘贴进终端，最后按 `Ctrl+D` 结束输入。

### 运行（读取文件）

```bash
node bin/ip-clash-speedtool.js --input ./fofa.txt
```

### 输出格式

```
IP:端口 #落地国家地区+序号+空格+节点城市+中转+空格+ASN全称
```

示例：

```
121.199.63.104:443 #美国加州圣何塞1 杭州中转 Aliyun.co.LTD
```

### 说明与限制

- Geo/ASN API 默认使用 `ip-api.com`（GET 参数传递），免费接口存在速率限制，因此实现里做了 `minIntervalMs` 间隔控制。
- Mihomo REST API 用于：
  - `/proxies/{name}/delay` 做连通性/延迟测试
  - `/proxies/GLOBAL` 切换当前使用的节点
- 落地 IP 通过本地混合端口（`mixed-port`，默认 `7890`）作为代理，请求 `ipify` 获取。
>>>>>>> master

