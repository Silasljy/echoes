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
