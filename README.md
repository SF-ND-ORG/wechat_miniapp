# 点歌台微信小程序前端
基于原生小程序实现

## 初始化

先安装组件库：

``` bash
npm i tdesign-miniprogram -S --production
```

然后在微信开发者工具内，点击 工具 -> 构建 npm。

## 本地配置（不提交到 Git）

本地配置文件已从仓库中移除，只保留示例文件。首次使用请复制示例文件并填入自己的配置：

``` bash
# 填入自己的小程序 appid
cp project.config.json.example project.config.json

# 配置后端 API 地址
cp env/index.example.js env/index.js
```

- `project.config.json`：本地开发者工具配置，已在 `.gitignore` 中忽略
- `project.private.config.json`：由微信开发者工具自动生成，同样不提交
- `env/index.js`：本地后端地址，已在 `.gitignore` 中忽略

修改 `env/index.js` 中的 `API_BASE_URL` 即可指向自己的后端服务。

## 点歌试听

点歌页搜索结果的每首歌右侧都有「试听」按钮：

- 点击后调用后端 `/api/geturl`，通过 `InnerAudioContext` 播放 `stream_url`（由后端代理网易云音频流）
- 未登录网易云或账号非会员时，后端返回的是试听片段；页面会显示「试听片段 0:00-0:30」并在片段结束处自动停止
- 即使后端登录的是会员账号、接口返回完整歌曲，点歌页也只试听前 30 秒，避免把点歌页当成完整播放器
- 播放中可点击「暂停 / 继续」，切换歌曲、重新搜索或离开页面时会自动停止或暂停
- 代理地址播放失败时会自动回退到接口返回的网易云直链；后端未返回 `stream_url`（旧版本）时直接播放直链，兼容未升级的后端

注意：

- 真机与发布版本必须使用 HTTPS 的后端地址；本地 `http://127.0.0.1:8000` 需要在微信开发者工具中勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
- 如果小程序后台对媒体域名有限制，将后端域名加入 `downloadFile` 合法域名即可，无需添加网易云 CDN 域名

## 播放面板

运营端使用的点歌台播放面板由后端提供，访问 `http://localhost:8000/admin/`，使用后端 `.env` 中的 `ADMIN_PANEL_TOKEN` 登录。详细说明见[后端 README](../miniapp_backend/README.md#点歌台播放面板)。
