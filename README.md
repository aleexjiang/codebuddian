# Codebuddian

> CodeBuddy CLI in your Obsidian vault — chat, inline edit, slash commands, MCP and more.

Codebuddian 是一个 Obsidian 插件，将 [CodeBuddy CLI](https://www.codebuddy.cn) 嵌入你的 Obsidian 笔记库，让你可以在侧边栏与 AI 对话、选中文字做 inline edit、配置 MCP 工具，所有操作都在本地完成。

灵感来源于 [claudian](https://github.com/yishentu/claudian)，后端使用腾讯 CodeBuddy CLI 替代 Claude Code。

---

## ✨ 功能

- **💬 侧边栏对话** — 在 Obsidian 右侧面板开一个完整的 AI 聊天视图，支持多 Tab 会话
- **✏️ Inline Edit** — 选中笔记文字，用 AI 一键修改，带 diff 预览
- **🔧 工具审批流** — 当 AI 想执行文件操作等工具时，弹出审批卡片让你确认/拒绝
- **🔌 MCP 支持** — 配置 MCP 服务器，让 AI 调用外部工具
- **🎛 完整设置面板** — CLI 路径、模型、权限模式、system prompt、高级选项一网打尽
- **🌐 中英双语** — 自动跟随系统语言切换中文/英文界面
- **🧠 Provider-Neutral 架构** — 核心层与具体 CLI 解耦，方便未来扩展其他后端

---

## 📋 前置要求

- **Obsidian** ≥ 1.7.2（桌面版）
- **CodeBuddy CLI** — 安装方式：

```bash
npm install -g @tencent-ai/codebuddy-code
# 或使用别名
npm install -g cbc
```

安装后确认 CLI 可用：

```bash
codebuddy --version
# 或
cbc --version
```

> ⚠️ 本插件仅支持桌面端 Obsidian（需要 `child_process` 来启动 CLI 子进程）。

---

## 🚀 安装

### 手动安装（当前）

1. 从 [Releases](../../releases) 下载最新版本，或从源码构建（见下方）
2. 将 `main.js`、`manifest.json`、`styles.css` 复制到你的 Obsidian vault 目录下：
   ```
   <vault>/.obsidian/plugins/codebuddian/
   ```
3. 重启 Obsidian，进入 **设置 → 社区插件**，启用 Codebuddian

### 从源码构建

```bash
git clone https://github.com/aleexjiang/codebuddian.git
cd codebuddian
npm install
npm run build
# 产物在项目根目录：main.js, manifest.json, styles.css
```

---

## ⚙️ 配置

启用插件后，进入 **设置 → Codebuddian** 进行配置：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| **CLI Path** | CodeBuddy 可执行文件路径，留空则自动检测 | 自动检测 |
| **Auto Detect CLI** | 是否自动在 PATH 中查找 `codebuddy`/`cbc` | ✅ |
| **Model** | 使用的 AI 模型（如 `claude-opus-4.8`、`deepseek-v4-pro`） | CLI 默认 |
| **Permission Mode** | 工具权限模式：`default` / `plan` / `full-auto` | `default` |
| **System Prompt File** | 自定义 system prompt 文件路径 | — |
| **Append System Prompt** | 追加到 system prompt 末尾的文本 | — |
| **MCP Config Path** | MCP 服务器配置文件路径 | — |
| **Add Dirs** | 额外允许访问的目录列表 | — |
| **Max Turns** | 单次对话最大轮次（0 = 无限制） | 0 |
| **Effort** | 推理投入度：`low` / `medium` / `high` | `medium` |
| **Allowed Tools** | 始终允许的工具列表 | — |
| **Disallowed Tools** | 始终禁止的工具列表 | — |
| **Theme** | 界面主题：`light` / `dark` / `system` | `system` |
| **Font Size** | 聊天区域字体大小 | 14 |
| **Show Thinking** | 显示 AI 思考过程 | ❌ |
| **Auto Scroll** | 自动滚动到最新消息 | ✅ |
| **Debug Mode** | 开启调试日志 | ❌ |
| **Verbose Mode** | CLI 详细输出模式 | ❌ |

---

## 🎮 使用

### 打开聊天

- 点击左侧 Ribbon 栏的消息图标
- 命令面板（`Ctrl/Cmd + P`）搜索 `Codebuddian: Open chat`

### Inline Edit

1. 在 Markdown 编辑器中选中一段文字
2. 命令面板搜索 `Codebuddian: Inline edit selection`
3. AI 将生成修改建议，diff 预览后确认应用

### 工具审批

当 AI 请求执行工具（如读写文件）时，聊天界面会弹出审批卡片，你可以：
- ✅ **Allow** — 允许本次执行
- ❌ **Reject** — 拒绝本次执行

### 命令列表

| 命令 | 说明 |
|------|------|
| `Open chat` | 打开聊天侧边栏 |
| `New chat tab` | 新建聊天标签页 |
| `Inline edit selection` | 对选中文字做 inline edit |
| `Toggle plan mode` | 切换计划模式 |
| `Cancel current turn` | 取消当前正在执行的 turn |

---

## 🏗 架构

```
src/
├── main.ts                         # 插件入口
├── core/                           # Provider-neutral 核心层
│   ├── types/                      # 类型定义（chat, provider, tools, settings...）
│   ├── runtime/                    # ChatRuntime 接口与生命周期
│   ├── providers/                  # ProviderRegistry 注册中心
│   ├── security/                   # ApprovalManager 审批流
│   ├── bootstrap/                  # Storage & Session 持久化
│   ├── mcp/                        # MCP 配置解析与管理
│   ├── prompt/                     # Prompt 编译（@mention / instructions）
│   ├── commands/                   # 内置斜杠命令
│   ├── tools/                      # 工具名称、图标、输入输出定义
│   └── storage/                    # Home/Vault 文件适配器
├── providers/                      # 具体后端实现
│   └── codebuddy/                  # CodeBuddy CLI 适配
│       ├── transport-acp.ts        # ACP ndJSON 双向流传输
│       ├── transport-print.ts      # Print 模式一次性调用
│       ├── cli-detect.ts           # CLI 自动发现
│       ├── runtime/                # CodebuddyChatRuntime
│       ├── env.ts                  # 环境变量透传
│       ├── mcp-bridge.ts           # MCP 桥接
│       ├── prompt-encoding.ts      # Prompt 编码
│       └── registration.ts         # Provider 注册工厂
├── features/                       # 功能模块
│   ├── chat/                       # 聊天视图（View, Tab, Controllers, Renderers）
│   ├── inline-edit/                # Inline edit Modal + diff 预览
│   └── settings/                   # 设置面板
├── app/                            # 应用层（settings storage, defaults）
├── shared/                         # 共享组件（icons, modals）
├── utils/                          # 工具函数（logger, diff, path, shell-quote...）
├── i18n/                           # 国际化（zh-CN / en）
└── style/                          # CSS 样式
```

### 核心通信协议

插件通过 `codebuddy --acp --acp-transport stdio` 启动子进程，使用 ndJSON (newline-delimited JSON) 进行双向通信：

```
┌──────────────┐    stdin (JSON-RPC)    ┌──────────────────┐
│  Codebuddian │ ──────────────────────►│  CodeBuddy CLI   │
│  (Obsidian)  │                        │  (--acp stdio)   │
│              │ ◄──────────────────────│                  │
└──────────────┘    stdout (ndJSON)     └──────────────────┘
```

事件类型：`message` / `tool_use` / `tool_result` / `approval` / `thinking` / `turn_end` / `end`

---

## 🛠 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化自动重编译）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run typecheck

# Lint
npm run lint
```

---

## 📜 License

[MIT](LICENSE)

---

## 🙏 致谢

- [claudian](https://github.com/yishentu/claudian) — 本项目的灵感来源和架构参考
- [CodeBuddy](https://www.codebuddy.cn) — 提供底层 CLI 能力
- [Obsidian](https://obsidian.md) — 优秀的本地知识库工具
