# CloudflareCN-IP-Filteringtools
A tool for filtering, splicing, and integrating Cloudflare nodes, supporting Cloudflareworker integration.
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


