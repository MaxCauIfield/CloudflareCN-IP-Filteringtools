---

# CloudflareCN-IP-Filteringtools

一个用于筛选、集成Cloudflare节点的IP工具，支持Cloudflareworker集成，快速处理节点仓库并灵活输出格式化IP信息。
此工具通过prompt自动生成，便于定制与扩展。

---

## 功能说明

- 支持从指定RAW仓库（如GitHub txt文件）批量提取节点信息。
- 自动筛选中国节点（含“CN”），实现格式化输出与地区中文名称。
- 支持灵活配置API地址、批量数量、请求延迟。
- 自动调用Bulk IP地理信息API获取中国IP的地区代码与中文城市名。
- 根据返回与ASN信息辅助识别地区代码，支持ISO 3166-1标准国家地区码全覆盖。
- 可在线查看完整处理进度，实时输出列表结果。
- 一键txt下载结果。
- 输出格式完全适用于Cloudflareworker等集成需求。

---

## 示例输出

中国IP（如深圳地区，GD 广东）：

```
59.36.147.253:10011#GD3 深圳中转 CHINANET Guangdong province network
```

非中国IP（如德国）：

```
167.17.183.134:443#DE 德国直连 Baxet Group Inc.
```

地区未知情况：

```
14.21.7.146:11965#CN1 未知中转
```

---

## 工作流程

1. **提取 RAW 仓库文本**
   从指定URL（如：https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt）抓取全部IP节点行。

2. **筛选中国 IP**
   查找所有含 “,CN,” 片段的行，排除误筛。

3. **格式化 IP 列表**
   每行去除“,CN,”及后内容，仅保留IP和端口号，格式如 `ip:port#`。

4. **整理 API 查询串**
   抽取所有IP，组合成API请求方式：
   `https://api.proxynova.com/v1/geolocation/bulk?ip=ip1,ip2,ip3...`

5. **请求 geolocation API**
   调用API批量获取地理位置，地区代码(city, region)等。

6. **地区代码与中文映射**
   根据API返回与ASN信息自动识别区域，优先使用region_code, 并附带中国省份/城市中文名称，ISO 3166-1全覆盖。

7. **格式化输出**
   按`ip:port#地区代码+序号+地区中文+中转+原始ASN信息`模式输出结果。
   未知地区统一为`未知中转`，非中国IP为`直连+国家名称+直连+ASN`。

8. **实时进度与txt下载**
   页面实时显示处理进度，支持导出txt。

---

## 用户交互及配置项

- **RAW仓库地址**：可自定义输入TXT文件URL
- **API地址**：自定义调用Bulk IP地理API地址
- **每批数量**：自定义每次上传IP数量（如每当40个IP批次）
- **并发延迟**：自定义每批处理间延迟（如350ms，防止速率限制）
- **国家/地区码字典**：内置ISO 3166-1标准240+个国家及中国省份、城市中文映射

---

## 支持场景

- Cloudflare CDN中转节点筛选
- IP 地域批量处理
- 节点面板导出与格式转换
- Worker/自定义脚本集成

---

## 使用说明

1. 打开页面，配置RAW仓库、API、批量参数
2. 点击“开始处理”
3. 查看实时输出与处理进度
4. 处理完毕可在线预览并一键下载txt格式结果

---

## 项目prompt（自动生成工具说明）

> 我想让你使用HTML语言，编写写一个筛选小工具，实现以下功能：
> 1.首先，从这个地址中提取文本信息：
> https://raw.githubusercontent.com/papapapapdelesia/Emilia/main/Data/alive.txt
> 你会看到一行一行的文本信息
> ...
> 59.36.76.111,10011,CN,CHINANET Guangdong province network
> 39.98.224.123,443,CN,Aliyun Computing Co., LTD
> ...
> 
> 2.然后，遍历查找其中包含“,CN,”字段的文本信息，并筛选出来，筛选完成后可能是这样的
> 注：这一步是筛选出仓库里所有的中国IP，前后的,是避免误筛选
> ...
> 3.去除“,CN,”以及每一行后面的所有内容，完成后，数据看起来是这样的：
> ...
> 4.对这些数据查找其中的“,”，并将其替换为“:”
> ...
> 5.在每一行的后面添加“#”，完成后，数据看起来是这样的
> ...
> 6.提取数据冒号前的字段，提取到的内容看起来是这样的
> ...
> 将这些ip排列起来，并使用“,”分割，不换行
> 完成后，看起来是这样的：
> ...
> 使用GET查询这个API网址
> https://api.proxynova.com/v1/geolocation/bulk?ip=
> 并将其拼接到api查询的末尾端，完成后，请求的网址看起来应为：
> https://api.proxynova.com/v1/geolocation/bulk?ip=14.21.7.146,117.50.80.157,59.36.147.253 ...
> 请求后，得到JSON看起来是这样的：
> ...
> 将返回的JSON数据与第5步中的目标ip一一对应起来
> 将"city": " "字段中的内容翻译为中文地区格式，提取出来
> 将 "region": " "字段中的内容提取出来
> 将原始,CN,后的字段中的内容提取出来，一一对应ip
> 最后把它们按照：
> IP+端口号+#+region+数字+空格+city+中转（这个只是文字）+空格+原始“,CN,”后的字段（不包括“,CN,”）
> 的格式拼接起来，其中的数字段是按照输出每一行的行数来排序的，比如第一行就是1，第二行就是2
> 以59.36.147.253为例，完成后的正确格式应为：
> 59.36.147.253:10011#GD3 深圳中转 CHINANET Guangdong province network
> 
> 7.格式化输出并显示数据，使其以文本的方式正确显示在网页上，并显示一共输出了多少个节点
> 
> 注：如果返回的数据为空或未知，那么
> 它看起来应该是这样：
> 59.36.147.253:10011#CN3 未知中转
> 
> 最后，它看起来的格式应为这样：
> 14.21.7.146:11965#CN1 未知中转
> 117.50.80.157:1234#CN2 未知中转
> 59.36.147.253:10011#GD3 深圳中转 CHINANET Guangdong province network
> xx.xx.x.xxx:xxxxx#xx4 xx中转 xxxxxxxxx
> ...

---

## 技术与依赖

- 原生HTML+JS (支持所有现代浏览器)
- 在线API（proxynova geolocation bulk）
- 国家地区全中文字典（ISO 3166-1全覆盖）
- 处理逻辑基于prompt自动生成

---

## 参考与联系

- [Emilia Cloudflare节点仓库](https://github.com/papapapapdelesia/Emilia)
- [ProxyNova Geolocation Bulk API](https://api.proxynova.com/v1/geolocation/bulk?ip=)
- 可通过Issues反馈、提交改进建议

---

### License

MIT License / 可公开再利用

---

> 如果需要HTML源代码，请在Issues请求或参考本项目HTML文件。

---
