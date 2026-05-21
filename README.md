
# echoes — 历史人物对话 Agent 原型

这个仓库包含一个最小可运行的后端原型，展示了项目的核心模块：
- 角色宪法（`packages/shared` / `apps/api/src/modules/constitution.ts`）
- 对话上下文管理器（`apps/api/src/modules/contextManager.ts`）
- 知识核查与注入（`apps/api/src/modules/knowledgeService.ts`）
- 思辨分析引擎（`apps/api/src/modules/analysisService.ts`）
- API 服务（`apps/api`）

快速开始：

1. 安装依赖（需要 pnpm）：

```powershell
cd d:/my_projects/echoes
pnpm install
pnpm --filter @echoes/api dev
```

2. 使用 POST 请求到 `http://localhost:4000/chat` 测试对话：

请求体 JSON 示例：

```json
{
  "role": "孔子",
  "input": "什么是仁？",
  "mode": "dialogue"
}
```

说明：当前实现使用内置的 LLM 模拟器（便于离线测试）。可替换为真实 LLM Provider（OpenAI、Anthropic 等）。

后续建议：实现多角色辩论、接入真实 LLM、完善知识库与持久化存储。

前端运行：

```powershell
pnpm --filter @echoes/web dev
```

DeepSeek 集成：将密钥放到本地环境变量 `DEEPSEEK_API_KEY`（或使用 .env 文件并在运行前加载），后端会优先使用 DeepSeek，失败或未配置时回退为本地模拟器。

部署提醒：生产环境请在 `apps/api/.env` 中放置 `DEEPSEEK_API_KEY`，然后重启 `pm2`；后端会自动从 `apps/api/.env`、项目根目录 `.env` 或进程环境变量中读取。

## 最新状态摘要

- 已集成本地 JSON 持久化对话数据库：默认保存在仓库根 `echoes.db.json`，最大条目数可通过环境变量 `ECHOES_DB_MAX_ENTRIES` 调整（默认 1000）。超过时会自动保留最近 N 条。
- 前端采用了轻量化设计系统（CSS tokens）：颜色/字号/间距/半径/阴影均使用 CSS 变量集中管理，移除了背景渐变与过度阴影，按设计规范排列组件样式（见 `apps/web/src/style.css`）。
- 会话清理行为：当前前端在页面卸载或切换到后台时，会尝试通过 `navigator.sendBeacon`（若可用）或同步 XHR 向后端的 `/session/end` 发送通知以清理服务端会话。界面上尚未提供显式的“结束会话”按钮；如需显式结束会话，请在前端实现对应 UI 并调用该接口。
- 已添加一键部署脚本：`scripts/deploy.sh`（支持分支选择与可选备份），用于在服务器上自动 pull/build/publish 并重启 pm2 进程。

## 环境变量（重要）

- `DEEPSEEK_API_KEY` — DeepSeek API 密钥（可选）。若未配置，后端将使用本地 LLM 模拟器作为回退。
- `DEEPSEEK_API_URL` — DeepSeek 服务基础 URL（可选）。
- `PORT` — API 端口（默认值 4000）。
- `ECHOES_DB_PATH` — JSON 数据库文件路径（默认：`./echoes.db.json`）。
- `ECHOES_DB_MAX_ENTRIES` — 保存的最大对话条目数（默认：1000）。

## 部署（快速）

在服务器上（假定仓库路径为 `/root/echoes`，nginx 静态目录为 `/var/www/gyx.luxe/web`）：

```bash
cd /root/echoes
git pull origin main
chmod +x scripts/deploy.sh
# 带备份运行（默认）
sudo ./scripts/deploy.sh main
# 或者不做备份
sudo ./scripts/deploy.sh main --no-backup
```

脚本将会：

- 拉取最新代码并运行 `pnpm install`，构建前后端
- 将 `apps/web/dist` 发布到 `/var/www/gyx.luxe/web`
- 确保 `apps/api/.env` 存在（若缺失则创建占位文件，需在服务器上补入真实密钥）
- 构建后端并重启或启动名为 `echoes-api` 的 pm2 进程
- 运行基础健康检查并尝试重载 nginx

如果你希望手动执行最小化的更新（不做备份），可以按下面步骤：

```bash
cd /root/echoes
git pull origin main
pnpm install
pnpm --filter @echoes/api build
pm2 restart echoes-api
pnpm --filter @echoes/web build
sudo rm -rf /var/www/gyx.luxe/web/*
sudo cp -r apps/web/dist/* /var/www/gyx.luxe/web/
sudo chown -R www-data:www-data /var/www/gyx.luxe/web
sudo nginx -t && sudo systemctl reload nginx
```

## 前端（开发与部署）

- 本地开发：在仓库根目录运行以下命令启动前端开发服务器（热重载）：

```bash
pnpm --filter @echoes/web dev
```

- 构建生产版本：

```bash
pnpm --filter @echoes/web build
```

- 构建产物位置：`apps/web/dist`，该目录为静态站点目录。若使用本仓库提供的一键部署脚本，脚本会将 `apps/web/dist` 的内容发布到服务器上的 `/var/www/gyx.luxe/web`。

- 静态部署（手动）：

```bash
pnpm --filter @echoes/web build
sudo rm -rf /var/www/gyx.luxe/web/*
sudo cp -r apps/web/dist/* /var/www/gyx.luxe/web/
sudo chown -R www-data:www-data /var/www/gyx.luxe/web
sudo nginx -t && sudo systemctl reload nginx
```

- 前端与 API 的连接：前端在运行时通过环境变量 `VITE_API_URL` 指定后端地址（默认为 `https://gyx.luxe` 或 `http://localhost:4000` 在本地开发）。构建前可在环境或 CI 中设置该变量以指向正确的 API 地址。

- 功能要点：Enter 发送消息、分段显示 AI 回复、展示证据并标注“AI 生成，未经证实”、本地保存会话历史。前端在卸载/隐藏时会尝试调用后端的 `/session/end` 接口以通知服务端（通过 `sendBeacon` 或同步 XHR）；若需显式的“结束会话”按钮，需在前端实现并调用该接口。


## 注意与故障排查

- 若 `pnpm install` 报错 `ERR_PNPM_OUTDATED_LOCKFILE`，可运行 `pnpm install --no-frozen-lockfile` 更新 lockfile，或在环境中升级 pnpm。
- 查看 API 日志：`pm2 logs echoes-api --lines 200`
- 查看 Nginx 错误日志：`sudo tail -n 200 /var/log/nginx/error.log`

## 贡献

请勿将密钥或敏感配置提交到仓库（`apps/api/.env` 已加入忽略）。生产环境请在服务器上单独维护 `.env` 或使用托管服务的密钥管理功能。
