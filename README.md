为CloudFlareCDN设计的网络路由跟踪工具，基于Node.js开发
# Cloudflare CDN Route traceroute

Cloudflare CDN Route traceroute 是一个专为Cloudflare CDN 网络设计的智能路由跟踪，测绘与分析工具。

不同于传统的“优选IP”工具，仅测试延迟或带宽，它更关注 CloudFlare Anycast 网络的真实路径行为。

## ✨ 项目特色：

- 🌍 **智能路由分析**：去除无效CDN负载服务器节点，标记CDN入站（用户侧），CDN出站（站长侧），ASN与所属运营商信息（CF部分地区的CDN节点为合作节点，非CF运营）

- ⚙️ **灵活访问控制**：基于无头 **Mihomo** 核心的访问控制规则，灵活可配置，基于规则，站长可充分模拟分析用户访问环境/攻击者环境，搭建完善的反DDOS/CC攻击应急预案体系

- 📥 **零信任网设计**：基于零信任网络设计，内置ECH访问控制规则，加密分析服务器SNI，即使站长的家庭网络被劫持并MITM网络设备，也无法获得任何有效的优选信息，间接避免攻击者对源站服务器发起针对性攻击

- 📍**查询负载均衡**：智能负载均衡查询，用户可添加多个IP查询API，且不会因单个API失效造成工具无法正常查询信息，PING+TCP测速，查询进度实时展示，可视化程度高

-  🗺️ **完整映射表** ：内置 ISO 3166-1 标准下 240+ 国家/地区映射表，多项可配置参数，在线预览查询结果，并智能保存多次内容，地图自动绘制CDN节点路由跳跃情况

## 📊 技术细节：

ECH服务器使用`cloudflare-ech.com`，详细介绍可参阅：
[Encrypted Client Hello - 隐私的最后一块拼图 - The CloudFlare Blog](https://blog.cloudflare.com/en-us/announcing-encrypted-client-hello/)

有关于CloudFlare实时状态路由信息，请参阅：
[路由服务的系统状态 - CloudFlare](https://www.cloudflarestatus.com/)

## 🚀 快速开始：

#### 前置条件

- Node.js 18+ (建议20/22）

- Linux 下可执行的 `mihomo` 核心（本工具支持从 GitHub Releases 自动下载； 若你的网络无法正常下载，请手动下载并配置 `mihomo.binPath`）
- 数据源：FOFA 或 Github Search

#### 运行（WebUI）

```
npm run web
```

打开浏览器，访问： http://127.0.0.1:8787/

#### 高级CLI配置（开发人员使用）

复制一份配置文件：

```shell
cp config.example.json config.json
```

如需手动指定 mihomo：

- `config.json` 里把 `mihomo.binPath` 指到可执行文件
- 或使用环境变量 `MIHOMO_BIN=/path/to/mihomo`

#### 运行（推荐：stdin 直接粘贴 FOFA）

```shell
node bin/ip-clash-speedtool.js --stdin
```

然后把 FOFA 复制的表格内容粘贴进终端，最后按 `Ctrl+D` 结束输入。

#### 运行（读取文件）

```shell
node bin/ip-clash-speedtool.js --input ./fofa.txt
```

#### 输出格式

```
IP:端口 #出站国家地区+序号+空格+入站节点城市+中转+空格+ASN全称
```


## ⚠️问题：

- 映射表不完整，某些地区可能无法正常翻译显示，如有需要请自行添加映射字典。
- Geo/ASN API 默认使用 `ip-api.com`（GET 参数传递），免费接口存在速率限制，因此实现里做了 `minIntervalMs` 间隔控制。
- Mihomo REST API 用于：
    - `/proxies/{name}/delay` 做CDN节点连通性/延迟测试
    - `/proxies/GLOBAL` 切换当前使用的CDN负载均衡节点
- CDN出站 IP 通过本地混合端口（ `mixed-port`，默认 `7890`）作为代理，请求 `ipify` 获取。

## 🙏 致谢

以下开源项目为本项目提供了支持

Geolocation API: [ProxyNova](https://api.proxynova.com/)

## 📄 许可证

GPL-3.0 license @ 2026
