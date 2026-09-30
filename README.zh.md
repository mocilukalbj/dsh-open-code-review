# Open Code Review for DeepSeek Harness

[English](README.md) | 中文

把阿里 [Open Code Review](https://github.com/alibaba/open-code-review) 接入 DSH 的社区插件。默认由 OCR 筛选文件、解析规则，**当前 DSH Agent 使用当前会话的模型审查代码**。无需另配 OCR API Key。

这是社区适配，非阿里或 DeepSeek 官方插件。委托模式复用 OCR 的确定性步骤，不等同于 OCR 完整的独立 Agent、评论定位与反思流程；完整流程作为可选模式提供。

## 安装

要求 DSH **0.1.7-rc.2 或 0.2.0-rc.2**、Node.js 22+、Git 2.41+。插件 **0.1.1** 修复了旧版在 DSH 0.2.0-rc.2 下的版本准入问题；其他内核版本需另行验证。标准 base/web 配置提供所需服务；自定义配置需包含 tools、skills、subprocess、sandboxPolicy、sandbox，以及用于展示和调用技能的 dsh-tool-skill。

推荐从已发布的 npm 包安装到实际使用的 profile：

```sh
dsh plugin --profile web add dsh-open-code-review@0.1.1 --save-exact --ignore-scripts
```

也可安装同版本的 GitHub Release 发布包：

```sh
dsh plugin --profile web add https://github.com/mocilukalbj/dsh-open-code-review/releases/latest/download/dsh-open-code-review.tgz --ignore-scripts
```

也可安装本地项目目录：

```sh
dsh plugin --profile web add /绝对路径/dsh-open-code-review --ignore-scripts
```

依主程序提示刷新或重启；若当前会话没有刷新技能列表，开启新会话。插件固定依赖官方 OCR **1.12.10**，无需再全局安装 OCR。保留 npm/pnpm 的可选依赖；原生二进制覆盖 Linux、macOS、Windows 的 x64/arm64。上游 OCR 带有 `postinstall`，但本插件直接使用可选依赖提供的原生二进制，无需运行该脚本；因此安装命令使用 `--ignore-scripts`，不必全局允许构建。审查期间不会自动下载安装。

dsh-market 的“发现”列表取决于目录收录状态；直接按包名或 Release 地址安装无需等待市场展示。详见 [市场提交说明](marketplace/README.md)。

## 使用

在 DSH 对话中输入：

```text
/open-code-review 审查当前未提交的修改，用中文报告，重点检查逻辑错误和安全缺陷。
```

也可以自然语言指定“相对 main 审查当前分支”或“审查某个 commit”。默认只审查；明确要求“审查并修复”时，Agent 才修改代码。

| 工具 | 默认状态 | 用途 |
| --- | --- | --- |
| `ocr_preview` | 开启 | 列出工作区、分支或提交的待审文件、排除原因和范围信息，不调用模型。 |
| `ocr_rules` | 开启 | 按相同规则分组，返回每批 1–200 个路径的审查规则，不调用模型。 |
| `ocr_review` | 需开启 | OCR 调用独立配置的模型执行完整审查。 |
| `ocr_llm_test` | 需开启 | 检查 OCR 独立模型配置的连通性。 |

`repo` 默认使用**当前会话工作目录**。`from` 配合 `to`（默认 HEAD）用于分支比较，`commit` 用于单次提交，不能混用。规则配置沿用上游行为：即使检查历史提交，也从当前检出的规则文件加载配置；范围参数仍传给 OCR，用于依赖文件内容的规则匹配。

Agent 会按 `(路径, 状态)` 维护完整清单，最终给出问题证据、位置、严重程度和已审/跳过数量。无效 JSON、非零退出、输出截断、超时和取消都按失败处理，不冒充“没有问题”。

## 配置

在相应 profile 的 `cordis.patch.yml` 添加覆盖条目（支持配置界面的主程序也可通过插件 Config 表单修改）：

```yaml
- id: open-code-review
  config:
    enableManagedReview: false
    delegateTimeoutMs: 60000
    reviewTimeoutMs: 900000
    maxOutputBytes: 8388608
    ocrPath: ''
    forwardEnv: []
```

- `enableManagedReview`：是否提供完整审查工具，默认关闭。
- `ocrPath`：可选的 OCR **原生可执行文件绝对路径**，不能填 shell 命令、JS 文件或 `.cmd`；留空使用包内固定版本。自定义版本需支持委托 JSON schema 1。
- `delegateTimeoutMs` / `reviewTimeoutMs`：委托命令与完整审查的超时，单位毫秒。
- `maxOutputBytes`：输出上限，默认 8 MiB；超限明确报错，可缩小范围或提高上限。
- `forwardEnv`：明确允许传给 OCR 的环境变量**名称**，如 `[DEEPSEEK_API_KEY]`，不是密钥值。默认不会转发 DSH 的模型密钥。

完整模式需要通过上游 CLI 预先配置 OCR 模型，并开启 `enableManagedReview`。插件沿用已有 `~/.opencodereview/config.json`，不会复制 DSH 凭据或覆盖配置。完整模式会向 OCR 模型服务发送代码，并写入 OCR 会话记录，可能需要主程序审批一次更宽的文件访问权限。

执行使用 DSH 自身的进程管理和会话沙箱。拒绝后不会改用非沙箱执行。取消、超时、卸载会停止并等待所属进程退出。直接运行 OCR 原生程序，不启动 npm 启动器的后台更新检查。此插件针对本机 DSH，不负责把二进制部署到远程容器。

## 更新、卸载与验证

OCR 升级、DSH 兼容性、接入方式迁移、发布和回滚流程见 [更新维护说明](https://github.com/mocilukalbj/dsh-open-code-review/blob/main/UPGRADE.zh.md)。

dsh-market 可以检测已安装 npm 包的新版本；实际应用仍受 Host 的包脚本策略约束。也可用 `dsh plugin --profile web add dsh-open-code-review@<已验证版本> --save-exact --ignore-scripts` 安装指定版本；已有 Release 安装也可用此命令切换为 npm 来源。插件更新会一起更新其固定的 OCR 依赖，不影响另外安装的全局 OCR。GitHub Release 的带版本 tarball 仍可用于手动安装或回滚。

```sh
dsh plugin --profile web remove dsh-open-code-review
```

禁用/卸载会移除工具与 Skill，不删除用户已有的 OCR 配置和历史记录。

开发验证：

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:integration
npm pack --ignore-scripts
```

集成测试通过真实 Cordis Loader 加载 DSH 服务和插件，使用真实沙箱、OCR 二进制及临时 Git 仓库，不需要模型密钥。沙箱不可用时测试会失败，不会悄悄放行。模型审查质量和在线 API 连通性不在这些确定性测试的验证范围内。

Apache-2.0；上游来源与工作流改编说明见 [NOTICE](NOTICE)。
