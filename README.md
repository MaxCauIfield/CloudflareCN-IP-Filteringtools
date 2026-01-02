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


