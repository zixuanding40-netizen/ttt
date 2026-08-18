# 阿里云轻量应用服务器部署文档：Windows Server 2022 + Nginx

本文档用于把当前 `movie` 项目部署到阿里云轻量应用服务器。当前版本包含 React 前端、Node.js Express 后端和 SQL Server 数据库：Nginx 负责托管前端 `dist/`，并把 `/api/` 请求代理到本机后端服务。

部署完成后，你和同学可以通过下面的地址访问：

```text
http://服务器公网IP
```

如果后续绑定域名并配置 HTTPS，也可以通过：

```text
https://你的域名
```

## 1. 项目说明

当前项目是一个 `React + TypeScript + Vite` 静态网站。

- 本地开发目录：`D:\codes\movie`
- 本地构建命令：`npm.cmd run build`
- 本地构建产物：`dist/`
- 服务器系统：Windows Server 2022
- 服务器 Web 服务：Nginx for Windows
- 后端服务：Node.js + Express，默认监听 `127.0.0.1:3001`
- 数据库：SQL Server
- 服务器发布目录：`C:\www\movie\dist`
- Nginx 安装目录：`C:\nginx`

注意：当前项目没有后端数据库，数据保存在浏览器 `localStorage` 中。每个人访问网站后新增的电影、收藏、评分等数据只保存在自己的浏览器里，不会自动同步给其他同学。

服务器需要安装 Node.js，用于运行后端 API；不需要在服务器上进行前端开发。

## 2. 部署流程总览

完整流程如下：

```text
1. 本地开发代码
2. 本地执行 npm.cmd run build
3. 上传前端 dist 发布物和 server 后端目录
4. SQL Server 执行 server/schema.sql 建表
5. 服务器配置 server/.env
6. 服务器启动 Node.js 后端
7. Nginx 托管前端并代理 /api/
8. 放行阿里云防火墙和 Windows 防火墙 80 端口
9. 浏览器访问 http://服务器公网IP
```

## 3. 本地构建发布物

在本地 Windows 电脑打开 PowerShell，进入项目目录：

```powershell
cd D:\codes\movie
```

如果还没有安装依赖，先执行：

```powershell
npm.cmd install
```

构建生产版本：

```powershell
npm.cmd run build
```

检查 `dist` 目录：

```powershell
Get-ChildItem .\dist
```

应该能看到类似内容：

```text
index.html
assets
chat.html
```

如果 PowerShell 执行 `npm` 报 `npm.ps1 cannot be loaded`，继续使用 `npm.cmd` 即可：

```powershell
npm.cmd -v
npm.cmd run build
```

## 4. 本地压缩 dist

仍然在本地项目目录 `D:\codes\movie` 下执行：

```powershell
Compress-Archive -Path .\dist -DestinationPath .\movie-dist.zip -Force
```

确认压缩包生成：

```powershell
Get-ChildItem .\movie-dist.zip
```

这个 `movie-dist.zip` 就是需要上传到服务器的发布物。

## 5. 上传文件到服务器

你需要上传这些内容到 Windows Server 2022：

```text
1. 本地生成的 movie-dist.zip
2. 项目里的 server 目录
3. package.json
4. package-lock.json
5. 你已经准备好的 Windows 版 Nginx 压缩包，例如 nginx-1.xx.x.zip
```

推荐先上传到服务器桌面：

```text
C:\Users\Administrator\Desktop
```

可以使用以下任意方式上传：

```text
远程桌面复制粘贴
Windows 自带远程桌面磁盘映射
SCP
SFTP 工具，例如 Xftp、WinSCP
阿里云控制台提供的文件上传能力
```

如果你本地可以使用 `scp`，示例命令如下：

```powershell
scp .\movie-dist.zip Administrator@服务器公网IP:C:/Users/Administrator/Desktop/
```

如果服务器未开启 SSH，使用远程桌面或 SFTP 工具上传即可。

## 6. 服务器准备目录

登录 Windows Server 2022 后，打开 PowerShell。

创建网站目录：

```powershell
New-Item -ItemType Directory -Force C:\www\movie
```

如果之前已经部署过旧版本，可以先删除旧发布物：

```powershell
Remove-Item -Recurse -Force C:\www\movie\dist
```

如果提示目录不存在，可以忽略。

## 7. 使用已有 Nginx 压缩包安装 Nginx

假设你的 Nginx 压缩包已经放在：

```text
C:\Users\Administrator\Desktop\nginx-1.xx.x.zip
```

在服务器 PowerShell 中执行：

```powershell
Expand-Archive -Path C:\Users\Administrator\Desktop\nginx-*.zip -DestinationPath C:\ -Force
```

解压后通常会得到类似目录：

```text
C:\nginx-1.26.2
```

为了后续命令统一，把它重命名为 `C:\nginx`。

如果当前不存在 `C:\nginx`，执行：

```powershell
Rename-Item C:\nginx-1.* C:\nginx
```

如果已经存在 `C:\nginx`，请先确认旧目录是否还需要保留。确认不需要后可以删除旧目录：

```powershell
Remove-Item -Recurse -Force C:\nginx
Rename-Item C:\nginx-1.* C:\nginx
```

检查 Nginx 程序是否存在：

```powershell
Get-ChildItem C:\nginx
Get-ChildItem C:\nginx\nginx.exe
```

## 8. 解压网站发布物

假设 `movie-dist.zip` 已经上传到：

```text
C:\Users\Administrator\Desktop\movie-dist.zip
```

执行：

```powershell
Expand-Archive -Path C:\Users\Administrator\Desktop\movie-dist.zip -DestinationPath C:\www\movie -Force
```

检查发布物目录：

```powershell
Get-ChildItem C:\www\movie\dist
```

应该能看到：

```text
index.html
assets
chat.html
```

如果你看到的是：

```text
C:\www\movie\dist\dist\index.html
```

说明多解压了一层目录，需要整理成：

```text
C:\www\movie\dist\index.html
C:\www\movie\dist\assets
C:\www\movie\dist\chat.html
```

## 9. 配置 SQL Server

本版本需要 SQL Server 保存用户账号和每个用户的片单数据。

在 SQL Server Management Studio 中连接本机 SQL Server，然后打开项目里的建表脚本：

```text
server\schema.sql
```

执行该脚本后，会创建：

```text
CineList 数据库
dbo.Users 用户表
dbo.UserAppStates 用户应用状态表
```

如果你希望使用专门的数据库账号，可以创建一个 SQL Server 登录名，并授予 `CineList` 数据库读写权限。后端 `.env` 中会用到这个账号和密码。

## 10. 部署并配置后端 API

服务器需要安装 Node.js 22 LTS 或更新版本。Node.js 安装包你可以自行下载并安装。

建议把后端放在：

```text
C:\deploy\movie-server
```

目录结构示例：

```text
C:\deploy\movie-server
├── package.json
├── package-lock.json
└── server
    ├── index.js
    ├── db.js
    ├── auth.js
    ├── schema.sql
    └── .env.example
```

复制 `.env.example` 为 `.env`：

```powershell
Copy-Item C:\deploy\movie-server\server\.env.example C:\deploy\movie-server\server\.env
notepad C:\deploy\movie-server\server\.env
```

按你的 SQL Server 信息修改：

```text
PORT=3001
JWT_SECRET=改成一串足够长的随机字符串
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=CineList
DB_USER=你的SQLServer用户名
DB_PASSWORD=你的SQLServer密码
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

安装依赖：

```powershell
cd C:\deploy\movie-server
npm.cmd install
```

启动后端测试：

```powershell
npm.cmd run server
```

看到类似输出说明后端已启动：

```text
CineList API listening on http://127.0.0.1:3001
```

打开另一个 PowerShell 测试接口：

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
```

如果返回：

```text
ok
--
True
```

说明后端 API 正常。

正式部署时建议把后端注册成 Windows 服务。可选工具：

```text
NSSM
```

NSSM 官方下载地址：

```text
https://nssm.cc/download
```

使用 NSSM 的服务配置思路：

```text
Application path: Node.js 的 node.exe 路径
Startup directory: C:\deploy\movie-server
Arguments: server/index.js
```

## 11. 配置 Nginx

打开 Nginx 配置文件：

```powershell
notepad C:\nginx\conf\nginx.conf
```

建议把原来的 `server` 配置替换为下面内容。如果你不熟悉 Nginx 配置，也可以直接把整个文件替换为以下完整配置：

```nginx
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout  65;

    server {
        listen 80;
        server_name _;

        root C:/www/movie/dist;
        index index.html;

        access_log logs/movie.access.log;
        error_log logs/movie.error.log;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /chat.html {
            try_files /chat.html =404;
        }

        location /assets/ {
            expires 30d;
            add_header Cache-Control "public, immutable";
            try_files $uri =404;
        }

        location /api/ {
            proxy_pass http://127.0.0.1:3001/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

注意：Nginx 配置里建议使用 `/`，所以路径写成：

```nginx
root C:/www/movie/dist;
```

不要写成：

```nginx
root C:\www\movie\dist;
```

## 12. 检查并启动 Nginx

进入 Nginx 目录：

```powershell
cd C:\nginx
```

检查配置：

```powershell
.\nginx.exe -t
```

如果看到类似输出，说明配置正确：

```text
syntax is ok
test is successful
```

启动 Nginx：

```powershell
start nginx
```

检查 80 端口：

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 80
```

如果 `TcpTestSucceeded` 是 `True`，说明服务器本机已经可以访问 Nginx。

本机浏览器访问：

```text
http://127.0.0.1
```

如果能打开电影网站首页，说明 Nginx 和发布物配置成功。

## 13. 放行防火墙

需要同时放行阿里云控制台防火墙和 Windows Server 防火墙。

### 13.1 阿里云轻量应用服务器防火墙

进入阿里云轻量应用服务器控制台，找到你的服务器，在“防火墙”中放行：

```text
80    HTTP 访问
443   HTTPS 访问，可选
```

如果暂时只使用 HTTP，先放行 `80` 即可。

### 13.2 Windows Defender 防火墙

在服务器 PowerShell 中执行：

```powershell
New-NetFirewallRule -DisplayName "Allow HTTP 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

如果后续需要 HTTPS，再执行：

```powershell
New-NetFirewallRule -DisplayName "Allow HTTPS 443" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

## 14. 公网访问验证

在你本地电脑或同学电脑浏览器中访问：

```text
http://服务器公网IP
```

继续验证聊天页：

```text
http://服务器公网IP/chat.html
```

部署完成后建议逐项检查：

```text
1. 首页能正常打开
2. 页面样式正常加载
3. 电影新增、编辑、删除功能可用
4. 刷新页面后数据仍保留
5. /chat.html 可以访问
6. 手机和同学电脑可以通过公网访问
7. 刷新页面不会出现 404
8. 可以注册新账号并登录
9. 登录后修改片单，刷新页面后数据仍存在
```

## 15. 常用 Nginx 命令

所有命令都在服务器 PowerShell 中执行。

进入 Nginx 目录：

```powershell
cd C:\nginx
```

检查配置：

```powershell
.\nginx.exe -t
```

启动 Nginx：

```powershell
start nginx
```

重载配置：

```powershell
.\nginx.exe -s reload
```

停止 Nginx：

```powershell
.\nginx.exe -s stop
```

查看是否占用 80 端口：

```powershell
netstat -ano | findstr :80
```

查看 Nginx 进程：

```powershell
Get-Process nginx
```

## 16. 后续更新网站

以后每次你在本地修改代码后，按下面流程更新服务器。

### 14.1 本地重新构建

本地 PowerShell：

```powershell
cd D:\codes\movie
npm.cmd run build
Compress-Archive -Path .\dist -DestinationPath .\movie-dist.zip -Force
```

把新的 `movie-dist.zip` 上传到服务器：

```text
C:\Users\Administrator\Desktop\movie-dist.zip
```

### 14.2 服务器替换发布物

服务器 PowerShell：

```powershell
Remove-Item -Recurse -Force C:\www\movie\dist
Expand-Archive -Path C:\Users\Administrator\Desktop\movie-dist.zip -DestinationPath C:\www\movie -Force
Get-ChildItem C:\www\movie\dist
```

重载 Nginx：

```powershell
cd C:\nginx
.\nginx.exe -s reload
```

然后重新访问：

```text
http://服务器公网IP
```

如果后端代码也更新了，同步更新 `C:\deploy\movie-server\server` 后重启后端服务。

## 17. 可选：绑定域名

如果你有域名，例如：

```text
movie.example.com
```

在域名 DNS 控制台添加解析：

```text
类型：A
主机记录：movie
记录值：服务器公网IP
```

等待解析生效后，修改：

```powershell
notepad C:\nginx\conf\nginx.conf
```

把：

```nginx
server_name _;
```

改成：

```nginx
server_name movie.example.com;
```

检查并重载：

```powershell
cd C:\nginx
.\nginx.exe -t
.\nginx.exe -s reload
```

访问：

```text
http://movie.example.com
```

## 18. 可选：HTTPS

如果要开启 HTTPS，推荐使用 Windows 上的证书工具，例如：

```text
win-acme
Certbot for Windows
```

插件和工具你可以自行下载。配置 HTTPS 前，请先确认：

```text
1. 域名已经解析到服务器公网 IP
2. 阿里云防火墙已经放行 443
3. Windows Defender 防火墙已经放行 443
4. HTTP 访问已经正常
```

## 19. 常见问题

### 19.1 本机能访问，公网不能访问

优先检查：

```text
1. 阿里云轻量应用服务器防火墙是否放行 80
2. Windows Defender 防火墙是否放行 80
3. Nginx 是否正在运行
```

服务器 PowerShell：

```powershell
Get-Process nginx
Test-NetConnection -ComputerName 127.0.0.1 -Port 80
```

### 19.2 访问还是 Nginx 默认页面

检查配置文件是否保存到了：

```text
C:\nginx\conf\nginx.conf
```

检查配置是否生效：

```powershell
cd C:\nginx
.\nginx.exe -t
.\nginx.exe -s reload
```

### 19.3 页面样式丢失

检查 `assets` 是否存在：

```powershell
Get-ChildItem C:\www\movie\dist\assets
```

确认 Nginx 配置中是：

```nginx
root C:/www/movie/dist;
```

### 19.4 刷新页面 404

确认 Nginx 配置中有：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

修改后重载：

```powershell
cd C:\nginx
.\nginx.exe -s reload
```

### 19.5 80 端口被占用

查看占用进程：

```powershell
netstat -ano | findstr :80
```

最后一列是进程 PID。可以用下面命令查看进程：

```powershell
tasklist | findstr 进程PID
```

如果是 IIS 占用了 80 端口，可以在“服务”里停止 IIS 相关服务，或者把 Nginx 改成监听其他端口，例如 `8080`。

如果改成 `8080`，Nginx 配置为：

```nginx
listen 8080;
```

同时需要在阿里云防火墙和 Windows 防火墙放行 `8080`，访问地址变为：

```text
http://服务器公网IP:8080
```

### 19.6 查看 Nginx 日志

访问日志：

```powershell
Get-Content C:\nginx\logs\movie.access.log -Tail 50
```

错误日志：

```powershell
Get-Content C:\nginx\logs\movie.error.log -Tail 50
```

### 19.7 注册登录接口失败

先确认后端是否启动：

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
```

再确认 Nginx 是否包含 `/api/` 代理配置，并执行：

```powershell
cd C:\deploy\nginx-1.28.0
.\nginx.exe -t
.\nginx.exe -s reload
```

如果后端启动时报数据库错误，检查：

```text
server\.env 中的 DB_SERVER、DB_DATABASE、DB_USER、DB_PASSWORD
SQL Server 是否允许 TCP/IP 连接
SQL Server 防火墙和端口是否正确
server\schema.sql 是否已经执行
```

## 20. 本次部署默认假设

- 服务器镜像是 Windows Server 2022。
- 你已经有 Windows 版 Nginx 压缩包。
- 服务器已安装 SQL Server。
- 服务器可以安装 Node.js 运行后端 API。
- Nginx 最终目录统一为 `C:\nginx`。
- 网站发布目录统一为 `C:\www\movie\dist`。
- 本地负责开发和构建，服务器只放发布物。
- 暂时先使用 HTTP 公网访问，HTTPS 后续再配置。
