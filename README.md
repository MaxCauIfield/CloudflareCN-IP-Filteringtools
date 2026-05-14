# Cloudflare CDN Route Traceroute

Cloudflare CDN Route Traceroute is an intelligent routing trace, mapping, and analysis tool designed specifically for the Cloudflare CDN network.

Unlike traditional "IP optimization" tools—which merely test for latency or bandwidth—this tool focuses more closely on the actual path behavior of the Cloudflare Anycast network. 

## ✨ Project Features:

- 🌍 **Intelligent Route Analysis**: Identifies and filters out invalid CDN load-balancing nodes; clearly labels CDN ingress (user-side) and CDN egress (origin-side) points; and provides ASN and carrier information (note: some CDN nodes in specific regions are operated by partners, not directly by Cloudflare).

- ⚙️ **Flexible Access Control**: Leverages access control rules based on the headless **Mihomo** core. Highly flexible and configurable, this rule-based system allows webmasters to fully simulate and analyze user access environments—as well as attacker environments—enabling the establishment of a comprehensive contingency framework against DDoS and CC attacks.

- 📥 **Zero Trust Network Design**: Built upon a Zero Trust Network architecture, featuring built-in ECH (Encrypted Client Hello) access control rules. It encrypts and analyzes server SNI data, ensuring that even if a webmaster's home network is hijacked or subjected to a Man-in-the-Middle (MITM) attack, attackers cannot obtain any valid "optimal route" information—thereby indirectly preventing targeted attacks against the origin server.

- 📍 **Load-Balanced Queries**: Features intelligent load-balancing for queries, allowing users to add multiple IP lookup APIs. This ensures that the tool remains fully functional and capable of retrieving information even if a single API fails. Includes both PING and TCP latency testing, with query progress displayed in real-time for a highly visualized user experience.

- 🗺️ **Comprehensive Mapping Table**: Includes a built-in mapping table covering over 240 countries and regions based on the ISO 3166-1 standard. Offers numerous configurable parameters, allows for online previews of query results, and intelligently saves historical data from multiple sessions. Additionally, it automatically generates a visual map illustrating the routing hops taken by CDN nodes.

## 📊 Technical Details:

The ECH server utilizes `cloudflare-ech.com`. For detailed information, please refer to:
[Encrypted Client Hello - The Last Piece of the Privacy Puzzle - The Cloudflare Blog](https://blog.cloudflare.com/en-us/announcing-encrypted-client-hello/)

For real-time routing status information regarding Cloudflare services, please refer to:
[Routing Service System Status - Cloudflare](https://www.cloudflarestatus.com/)

## 🚀 Quick Start:

#### Prerequisites

- Node.js 18+ (Versions 20 or 22 are recommended).

- An executable `mihomo` core binary for Linux (this tool supports automatic downloading from GitHub Releases; if your network prevents a successful automatic download, please download it manually and configure the `mihomo.binPath` setting).
- Data Sources: FOFA or GitHub Search

#### Running (WebUI)

```
npm run web
```

Open your browser and visit: http://127.0.0.1:8787/

#### Advanced CLI Configuration (For Developers)

Make a copy of the configuration file:

```shell
cp config.example.json config.json
```

If you need to manually specify the `mihomo` executable:

- Set the `mihomo.binPath` value in `config.json` to point to the executable file.
- Alternatively, use the environment variable `MIHOMO_BIN=/path/to/mihomo`.

#### Running (Recommended: Paste FOFA Data via stdin)

```shell
node bin/ip-clash-speedtool.js --stdin
```

Then, paste the table content copied from FOFA directly into your terminal, and finally press `Ctrl+D` to finish input.

#### Running (Read from File)

```shell
node bin/ip-clash-speedtool.js --input ./fofa.txt
```

#### Output Format

```
IP:Port #Outbound Country/Region + Index + Space + Inbound Node City + Transit + Space + Full ASN Name
```


## ⚠️ Issues:

- The mapping table is incomplete; some regions may not be translated or displayed correctly. If necessary, please add the required entries to the mapping dictionary yourself.
- The Geo/ASN API defaults to using `ip-api.com` (via GET parameters). Since this free API endpoint is subject to rate limits, the implementation includes a `minIntervalMs` control to manage request intervals.
- The Mihomo REST API is used for the following purposes:
- `/proxies/{name}/delay`: To perform connectivity and latency tests on CDN nodes.
- `/proxies/GLOBAL`: To switch the currently active CDN load-balancing node.
- The CDN outbound IP address is retrieved by routing a request to `ipify` through the local mixed-port (`mixed-port`, default: `7890`) acting as a proxy.

## 🙏 Acknowledgments

The following open-source projects provided support for this project:

Geolocation API: [ProxyNova](https://api.proxynova.com/)

## 📄 License

GPL-3.0 license @ 2026
