# LuckyNemo Windows Hub — Rebrand Notes

> **2026-07 更新：已迁入 monorepo。** 本目录（`apps/windows/`）现在是 LuckyNemo
> Windows 客户端的唯一事实源；原先的独立仓库方案（`lihaoalbert/luckynemo-windows`）
> 已作废。迁移方式与 macOS 相同（纯文件拷贝、不带 git 历史）。
> CI 已迁移至主仓 `.github/workflows/`：
> `windows-app-ci.yml`（构建/测试/发布，release tag 前缀 `windows-v*`）、
> `windows-app-gateway-lkg-update.yml`、`windows-app-codeql.yml`。
> 主仓 `windows-node-release.yml` 的 promote 流程改为从**本仓** `windows-v*`
> release 拉取已签名安装器（资产名 `LuckyNemoCompanion-*`）。
> 下文中的"本 fork remote origin"等独立仓库描述仅作历史记录。
>
> 迁移后新增遗留项：
> - **自动更新（Updatum）**：`App.xaml.cs` 的 `UpdatumManager` 已指向主仓
>   (`lihaoalbert/LuckyNemo`)，但 Updatum 没有 tag 过滤能力，
>   `FetchOnlyLatestRelease = true` 在多 release 流（gateway `vYYYY.M.PATCH` 与
>   `windows-v*` 混排）下会抓错 release。需在 Windows 上验证并改为筛选最新
>   `windows-v*` release（或把 Windows 发布移回独立仓库）。见代码内 TODO 注释。
> - GitVersion tag 前缀改为 `windows-v`（`GitVersion.yml`）；CI 用
>   `configFilePath: apps/windows/GitVersion.yml`。GitVersion.MsBuild 在
>   monorepo 下的配置发现行为需 Windows 构建首验。


本仓库是 `openclaw/openclaw-windows-node`（上游 OpenClaw Windows 客户端，MIT）的
LuckyNemo rebrand fork，作为 LuckyNemo 的 Windows 桌面套件（托盘 + 原生 chat +
WSL gateway 一键部署 + Windows node mode + 本地 MCP server）。

- 上游 remote：`upstream` → https://github.com/openclaw/openclaw-windows-node
- 本 fork remote：`origin` → git@github.com:lihaoalbert/luckynemo-windows.git
- 主仓（gateway 产品）：LuckyNemo（npm 包 `luckynemo`，CLI `luckynemo`，
  配置 `~/.luckynemo/luckynemo.json`，gateway 端口 18789）

品牌规范：产品名 **LuckyNemo**；包/路径/标识符一律小写 **luckynemo**；
吉祥物/助手名 **徐大恩**（chibi 小丑鱼）；品牌 emoji 🐠。

## 改动统计

- rebrand 前：`openclaw`（大小写不敏感）出现在 900 个文件、约 8374 处。
- rebrand 后：`luckynemo` 约 8324 处；`openclaw` 残留 45 处，全部为下方
  “协议/契约保留点”或上游归属说明（LICENSE、README 署名、注释），无一遗漏的品牌残留。
- 901 个文件被修改；60+ 个文件/目录经 `git mv` 重命名（含全部 `src/OpenClaw.*` →
  `src/LuckyNemo.*`、`tests/OpenClaw*` → `tests/LuckyNemo*`、csproj/slnx、
  脚本、图标与文档图片）。
- C# 命名空间/程序集/exe 名同步改为 `LuckyNemo.*`（如 `LuckyNemo.Tray.WinUI.exe`）。

## 主要标识符映射

| 类别 | 上游 | LuckyNemo |
|---|---|---|
| 产品显示名 | OpenClaw Companion | LuckyNemo Companion |
| MSIX 包标识 | `OpenClaw.Companion`(.Dev) | `LuckyNemo.Companion`(.Dev) |
| AppUserModelID | `OpenClaw.Companion` | `LuckyNemo.Companion` |
| Inno AppId (release) | `{M0LTB0T-TRAY-4PP1-D3N7}` 伪 GUID | `{A793B368-B0E0-4BDB-AA01-716E442A117E}`（新 GUID） |
| Inno AppId (dev) | `{M0LTB0T-TRAY-4PP1-DEV}` 伪 GUID | `{03C3206F-62B8-4A97-A888-53447F091B7D}`（新 GUID） |
| 数据目录 | `%APPDATA%\OpenClawTray`(-Dev) | `%APPDATA%\LuckyNemoTray`(-Dev) |
| 单实例 mutex | `OpenClawTray` | `LuckyNemoTray` |
| 开机自启注册表值 | `OpenClawTray` | `LuckyNemoTray` |
| 计划任务名 | `OpenClaw Companion` | `LuckyNemo Companion` |
| Deep link scheme | `openclaw://` / `openclaw-dev://` | `luckynemo://` / `luckynemo-dev://` |
| Deep link named pipe | `OpenClawTray-DeepLink*` | `LuckyNemoTray-DeepLink*` |
| WSL distro 名 | `OpenClawGateway`(-Dev) | `LuckyNemoGateway`(-Dev) |
| WSL 内 Linux 用户 | `openclaw` | `luckynemo` |
| WSL 内目录 | `~/.openclaw`、`/opt/openclaw`、`/var/{lib,log}/openclaw` | `~/.luckynemo`、`/opt/luckynemo`、`/var/{lib,log}/luckynemo` |
| WSL 内 CLI 调用 | `openclaw ...` | `luckynemo ...`（匹配主仓 npm bin 名） |
| gateway 配置文件 | `~/.openclaw/openclaw.json` | `~/.luckynemo/luckynemo.json`（匹配主仓 `src/config/paths.ts`） |
| 应用自有环境变量 | `OPENCLAW_*`（如 `OPENCLAW_TRAY_DATA_DIR`、`OPENCLAW_APP_IDENTITY`、`OPENCLAW_MCP_PORT`） | `LUCKYNEMO_*` |
| 遥测/日志资源名 | `openclaw-windows-tray` 等 | `luckynemo-windows-tray` 等 |
| userAgent（线上自由文本） | `openclaw-windows-tray/x.y` | `luckynemo-windows-tray/x.y` |
| 安装器产物名 | `OpenClawCompanion-Setup-{arch}.exe` | `LuckyNemoCompanion-Setup-{arch}.exe` |
| 发布仓库 URL | `github.com/openclaw/openclaw-windows-node` | `github.com/lihaoalbert/luckynemo-windows` |
| 网关 LKG 版本 | `2026.6.11`（npm `openclaw`） | `2026.7.2`（npm `luckynemo`） |

## GUID 处理决策

- **Inno Setup `AppId`（升级路径标识）**：上游使用伪 GUID（`M0LTB0T-...`）。
  已更换为两个全新真实 GUID（release / dev 各一）。这是有意为之：AppId 决定
  Windows“应用和功能”中的升级/卸载身份，换新后 LuckyNemo 与上游 OpenClaw 可
  共存安装、互不覆盖。`tests/LuckyNemo.Tray.Tests/InstallerIssAssertionTests.cs`
  中的断言已同步更新。
- **MSIX `Identity Name`**：非 GUID，但同为安装身份，已改为 `LuckyNemo.Companion`
  （Dev 为 `.Dev`），同样保证共存。
- **组件级/第三方 GUID 全部保留**：WebView2 的 well-known GUID
  (`F3017226-...`)、Windows shell/COM GUID、测试数据 GUID 均未改动。

## 协议/契约保留点（有意保留 `openclaw`，勿再 rebrand）

以下来源为 LuckyNemo 主仓的现行契约（主仓 rebrand 时保留了这些上游标识），
Windows 客户端必须与之一致：

1. **WebSocket gateway 协议**：协议版本、消息结构、`challenge`/`connected`
   握手、token 认证、默认端口 `18789`（dev 18790）——协议本身无品牌字符串，未动。
2. **线上 client id/mode**：operator 连接 `clientId="cli"`、node 连接
   `clientId="node-host"`（`src/LuckyNemo.Shared/OpenClawGatewayClient.cs:20`、
   `WindowsNodeClient.cs`）。主仓 `packages/gateway-protocol/src/client-info.ts`
   的 `GATEWAY_CLIENT_IDS` 是封闭注册表，这两个值为品牌中性，保持不变；
   代码处已加注释。
3. **systemd unit 名**：`openclaw-gateway.service`。主仓
   `src/daemon/constants.ts` 的 `GATEWAY_SYSTEMD_SERVICE_NAME` 仍为
   `openclaw-gateway`，`luckynemo gateway install` 生成的 unit 沿用此名。
   SetupEngine/E2E/校验脚本中所有 `systemctl`/`journalctl` 引用保持原值并加注释。
4. **gateway 进程环境变量前缀**：主仓仍读 `OPENCLAW_*` 环境变量
   （`src/config/config-env-vars.ts` 等）。因此保留：
   - `OPENCLAW_GATEWAY_TOKEN`（WSL 内向 gateway CLI 传 token）
   - `OPENCLAW_STATE_DIR`、`OPENCLAW_HOME`（`ExecApprovalsStore.cs` 定位 gateway 状态）
   - `OPENCLAW_GATEWAY_PORT`（DEVELOPMENT.md 中覆盖 gateway 端口）
   注意区分：**Windows 应用自身**的环境变量已全部改为 `LUCKYNEMO_*`。
5. **第三方引用**：`magimetal/openclaw-menubar`（Mac parity 对比的外部仓库）、
   `ClawHub`（主仓插件注册表产品名，主仓未 rebrand）保持原值。
6. **LICENSE / 署名**：保留上游 MIT 版权行与作者署名，追加 LuckyNemo 版权行。

## 占位符 / 需要用户替换的事项（TODO）

1. **代码签名证书主体名**：
   - `src/LuckyNemo.Tray.WinUI/Package.appxmanifest` 的 `Publisher="CN=LuckyNemo"`
     是占位符，必须替换成你自己证书的确切 subject（MSIX 要求严格匹配）。
   - `installer.iss` 的 `MyAppPublisher "LuckyNemo"` 为占位发布者名。
   - `.github/workflows/ci.yml` 的 `signing-account-name` / `certificate-profile-name`
     现为 `luckynemo` 占位，需在你的 Azure Artifact Signing（或改用其他签名方案）
     中创建同名账号/证书profile，并配置 `AZURE_CLIENT_ID/TENANT_ID/SUBSCRIPTION_ID`
     secrets 与 `release-signing` environment。
2. **CLI 安装脚本 URL**：`src/LuckyNemo.SetupEngine/GatewayLkgVersion.cs` 的
   `DefaultInstallUrl = "https://luckynemo.ai/install-cli.sh"` 是占位（该域名不存在）。
   需要为 LuckyNemo 提供与上游 `install-cli.sh` 等价的安装脚本端点（负责把
   npm `luckynemo` 包安装进 WSL 并在 `~/.luckynemo/bin` 放置 shim），或在
   setup 配置中显式设置 `Gateway.InstallUrl`。
3. **npm 包发布**：WSL 内一键部署依赖 npm 上存在 `luckynemo` 包（LKG 固定
   `2026.7.2`）。CI 的 LKG drift 检查会查询 `registry.npmjs.org/luckynemo/latest`，
   包未发布前该检查会告警/失败。
4. **图标与品牌资产**：已全面替换为徐大恩小丑鱼品牌图（2026-07-22，
   参照 luckynemo-macos 同源资产）：
   - `src/LuckyNemo.Tray.WinUI/Assets/luckynemo.ico`（托盘/安装器图标，
     16-256 共 8 档，由 macOS 版 `luckynemo-hero.png` 加圆角透明蒙版生成）
   - `src/LuckyNemo.Tray.WinUI/Assets/Setup/LuckyNemoMascot.png`（onboarding
     吉祥物，512x512，替换上游红色 Molty 形象）
   - `src/LuckyNemo.Tray.WinUI/Assets/` 下的 `StoreLogo.png`、`Square150x150Logo.png`、
     `Square44x44Logo.png`（含 targetsize-24/32/48/256 altform-unplated）、
     `Wide310x150Logo.png`、`SplashScreen.png`、`LockScreenLogo.png`、
     `Setup/Chrome/TitleBarIcon.png`（MSIX/向导资产，全部重新生成）
   - `docs/assets/readme-banner.jpg`（此前残留 "OpenClaw Windows Node" 字样，
     已替换为主仓 `luckynemo-banner-dark.png` 裁剪版）
   - 源图：luckynemo-macos `macos/Sources/LuckyNemo/Resources/luckynemo-hero.png`、
     主仓 `docs/assets/luckynemo-banner-dark.png`
   - 仍为 TODO：`docs/images/luckynemowindows*.png`（README 应用截图，
     需在 Windows 上运行新版应用重新截取）
5. **文档/营销域名**：`docs.luckynemo.ai`、`luckynemo.ai` 均为占位，README 与
   UI 中的文档链接在域名就绪前不可达。
6. **GitHub 远端建仓**：`origin git@github.com:lihaoalbert/luckynemo-windows.git`
   已配置但尚未推送，远端仓库可能还不存在。主仓 URL 引用暂以
   `github.com/lihaoalbert/LuckyNemo` 占位，请按实际主仓地址修正。
7. **命名核实**：吉祥物/助手名已确定为 **徐大恩**（chibi 小丑鱼，与主仓及
   luckynemo-macos 一致），品牌 emoji 为 🐠。README 已按
   `LuckyNemo (徐大恩)` 品牌格式更新。

## Windows 构建与签名环境

本机（macOS）**无法编译** C#/WinUI 3，本次 rebrand **未经 Windows 编译验证**。
构建需要：

- Windows 10 (20H2+) / Windows 11 主机或 runner
- .NET 10 SDK（`global.json` 固定）
- Windows 10 SDK (19041+)、WinUI 3 / Windows App SDK 2.3.1 workload
- Node.js LTS + npm（WinUI 构建资产，`@microsoft/mxc-sdk`）
- WebView2 Runtime
- Inno Setup 6（安装器，`installer.iss`；MSIX 打包当前在 CI 中暂停，`if: false`）
- 代码签名：Azure Artifact Signing（原 Azure Trusted Signing）账号 + 证书 profile，
  或替换成自己的 signtool 流程
- 构建入口：`.\build.ps1`（`-CheckOnly` 先验环境），本地安装器：
  `.\scripts\build-inno-local.ps1 -Arch x64 -Fast`

建议首次在 Windows 上验证的顺序：`dotnet restore` → `dotnet build` →
`dotnet test`（排除 E2E）→ `.\scripts\build-inno-local.ps1 -Arch x64 -Fast` →
Windows Sandbox 内安装/卸载冒烟 → 配好签名后打 `v*` tag 走完整 release CI。

## 发布流程建议

1. 先在 GitHub 创建 `lihaoalbert/luckynemo-windows` 仓库并推送（含完整历史与 tag）。
2. 发布 npm `luckynemo@2026.7.2`（主仓产物），并搭建 `install-cli.sh` 端点。
3. 配置 Azure 签名 secrets 与 `release-signing` environment；替换
   `Package.appxmanifest` Publisher。
4. 替换图标资产后，在 Windows runner 上跑 CI（test + e2etests + build 三个 job
   均已按 LuckyNemo 命名更新 artifact 名）。
5. 打 `v2026.7.x` tag 触发 release job：签名 → Inno 安装器 → GitHub Release
   （产物 `LuckyNemoCompanion-Setup-{x64,arm64}.exe` + 便携 ZIP + SHA256SUMS）。
6. 应用内自动更新从本仓库 GitHub Releases 读取（URL 已指向
   `lihaoalbert/luckynemo-windows`），首个 release 后可用 alpha channel 验证
   更新链路。
7. 主仓 `.github/workflows/windows-node-release.yml` 的 promote 流程（把已签名
   安装器纳入主 release）本次未涉及；若 LuckyNemo 主仓需要同样流程，需按本仓
   release 产物名单独适配。

## 验证状态

- ✅ 全文 grep：无遗漏品牌残留（45 处 `openclaw` 均为契约保留/归属说明）
- ✅ XML 语法：72 个文件全部解析通过（csproj/slnx/appxmanifest/xaml/resw/manifest/props）
- ✅ JSON 语法：10 个文件通过（`default-config.json` 为上游即有的 JSONC，非本次破坏）
- ✅ PowerShell 语法：全部 `.ps1` 经 `System.Management.Automation.Language.Parser` 解析，0 错误
- ✅ YAML 语法：全部 workflow/config 解析通过
- ✅ 跨文件一致性：AppIdentity.cs / installer.iss / Package.appxmanifest /
  slnx / csproj 引用与重命名后路径逐一核对
- ✅ 受影响的测试断言已同步（Inno AppId GUID、publisher、Tailscale hostname 默认值）
- ❌ **未经 Windows 编译验证**（macOS 无法构建 WinUI 3）；`dotnet build` /
  `dotnet test` / Inno 编译需在 Windows 上首验
