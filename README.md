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

