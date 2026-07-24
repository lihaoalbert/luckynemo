# 🐠 LuckyNemo (徐大恩) Windows Hub

![LuckyNemo (徐大恩) Windows banner](docs/assets/readme-banner.jpg)

A native Windows companion suite for [LuckyNemo](https://luckynemo.ai) - the AI-powered personal assistant.

LuckyNemo ships with a chibi-clownfish mascot called **徐大恩** ("Xú Dà'ēn"). It appears on the tray icon, the installer, the MSIX tiles and splash screen, and across the setup wizard.

*LuckyNemo Windows Hub - rebranded fork of [OpenClaw Windows Node](https://github.com/openclaw/openclaw-windows-node), originally made by Scott Hanselman and the OpenClaw community*

![LuckyNemo Windows Hub tray menu](docs/images/luckynemowindows1.png)

![LuckyNemo Windows Hub command center](docs/images/luckynemowindows2.png)

![LuckyNemo Windows Hub pairing and connection settings](docs/images/luckynemowindows3.png)

![LuckyNemo Windows Hub activity and diagnostics](docs/images/luckynemowindows4.png)

## Projects

This monorepo contains the Windows hub, shared client libraries, and CLI utilities:

| Project | Description |
|---------|-------------|
| **LuckyNemo.Tray.WinUI** | System tray application (WinUI 3) for quick access to LuckyNemo |
| **LuckyNemo.Connection** | Gateway registry, credential resolution, and connection manager |
| **LuckyNemo.Shared** | Shared gateway client library, capabilities, and MCP bridge |
| **LuckyNemo.Chat** | Native chat model and timeline reducer |
| **LuckyNemo.Cli** | CLI validator for WebSocket connect/send/probe using tray settings |
| **LuckyNemo.WinNode.Cli** | `winnode` CLI for invoking local Windows node/MCP capabilities |
| **LuckyNemo.SetupEngine** | Local gateway setup, WSL installation, and setup-code support |
| **LuckyNemo.SetupEngine.UI** | WinUI setup wizard pages hosted by the tray app |
| **LuckyNemoTray.FunctionalUI** | In-repo declarative WinUI helper used by native chat and newer UI surfaces |

## 🚀 Quick Start

> **End-user installer?** Download the latest stable x64 or ARM64 installer from the [LuckyNemo Windows docs](https://docs.luckynemo.ai/platforms/windows), or see [docs/SETUP.md](docs/SETUP.md) for step-by-step installation (no build required).
>
> **Managed WSL gateway?** Local setup creates a locked-down app-owned `LuckyNemoGateway` distro. See [docs/WSL_GATEWAY_ADMIN.md](docs/WSL_GATEWAY_ADMIN.md) for editing `luckynemo.json` as the `luckynemo` user and using root for protected-file administration.
>
> **Operator or node?** Start with [Operator and node concepts](docs/OPERATOR_NODE_CONCEPTS.md) for the beginner-facing glossary of gateway, operator, node, pairing, reapproval, and allowlisted node capabilities.

Direct downloads from the latest LuckyNemo Windows release:

- [LuckyNemoCompanion-Setup-x64.exe](https://github.com/lihaoalbert/LuckyNemo/releases/latest/download/LuckyNemoCompanion-Setup-x64.exe)
- [LuckyNemoCompanion-Setup-arm64.exe](https://github.com/lihaoalbert/LuckyNemo/releases/latest/download/LuckyNemoCompanion-Setup-arm64.exe)
- [LuckyNemoCompanion-SHA256SUMS.txt](https://github.com/lihaoalbert/LuckyNemo/releases/latest/download/LuckyNemoCompanion-SHA256SUMS.txt)

### Prerequisites
- Windows 10 (20H2+) or Windows 11
- .NET 10.0 SDK - https://dotnet.microsoft.com/download/dotnet/10.0
- Node.js LTS with npm (for WinUI build assets)
- Windows 10 SDK (for WinUI build) - install via Visual Studio or standalone
- WebView2 Runtime - pre-installed on modern Windows, or get from https://developer.microsoft.com/microsoft-edge/webview2

### Developer / Agent Setup

Use the setup script to install or verify local Windows build prerequisites:

```powershell
# Install missing prerequisites with winget, trust the checkout, and verify setup
.\scripts\setup-dev.ps1

# Check only; do not install packages or change git safe.directory
.\scripts\setup-dev.ps1 -CheckOnly

# Install/verify prerequisites without adding the checkout to git safe.directory
.\scripts\setup-dev.ps1 -NoTrustRepository

# Setup and run the required build/test validation
.\scripts\setup-dev.ps1 -RunValidation
```

### Build

Use the build script to check prerequisites and build:

```powershell
# Check prerequisites
.\build.ps1 -CheckOnly

# Build all projects
.\build.ps1

# Build specific project
.\build.ps1 -Project WinUI
```

Or build directly with dotnet:

```powershell
# Build all (use build.ps1 for best results)
dotnet build

# Build WinUI (requires runtime identifier for WebView2 support)
dotnet build src/LuckyNemo.Tray.WinUI/LuckyNemo.Tray.WinUI.csproj -r win-arm64  # ARM64
dotnet build src/LuckyNemo.Tray.WinUI/LuckyNemo.Tray.WinUI.csproj -r win-x64    # x64

# Build MSIX package (for camera/mic consent prompts)
dotnet build src/LuckyNemo.Tray.WinUI -r win-arm64 -p:PackageMsix=true  # ARM64 MSIX
dotnet build src/LuckyNemo.Tray.WinUI -r win-x64 -p:PackageMsix=true    # x64 MSIX
```

### Run Tray App

```powershell
# Build and launch the unpackaged WinUI tray app
.\run-app-local.ps1

# If you already built, skip rebuild and launch the existing Debug output
.\run-app-local.ps1 -NoBuild

# Run isolated from your normal tray settings so multiple worktrees can run together
.\run-app-local.ps1 -Isolated

# Opt into side-by-side dev identity (separate mutex, protocol, gateway distro, and port)
.\run-app-local.ps1 -Dev -Isolated

# Alpha update testing from a Release build
.\run-app-local.ps1 -Configuration Release -Isolated -UpdateChannel alpha

# Optional: launch through WinAppCLI with Package.appxmanifest
.\run-app-local.ps1 -UseWinApp -NoBuild
```

The default path starts the unpackaged executable directly. `-UseWinApp` requires
Microsoft WinAppCLI (`winget install Microsoft.WinAppCLI`) and is only needed when
you want manifest/MSIX-adjacent launch validation.

### Run CLI WebSocket Validator

Use the CLI to validate gateway connectivity and `chat.send` outside the tray UI.

```powershell
# Show help
dotnet run --project src/LuckyNemo.Cli -- --help

# Use tray settings from %APPDATA%\LuckyNemoTray\settings.json and send one message
dotnet run --project src/LuckyNemo.Cli -- --message "quick send validation"

# Loop sends and also probe sessions/usage/nodes APIs
dotnet run --project src/LuckyNemo.Cli -- --repeat 5 --delay-ms 1000 --probe-read --verbose

# Override gateway URL/token for isolated testing
dotnet run --project src/LuckyNemo.Cli -- --url ws://127.0.0.1:18789 --token "<token>" --message "override test"
```

## 📦 LuckyNemo.Tray (Nemo)

Modern Windows 11-style system tray companion that connects to your local LuckyNemo gateway.

### Features
- 🎨 **LuckyNemo branding** - LuckyNemo tray icon with status colors
- 🎨 **Modern UI** - Windows 11 flyout menu with dark/light mode support
- 💬 **Quick Send** - Send messages via global hotkey (Ctrl+Alt+Shift+C)
- 🔄 **Auto-updates** - Automatic updates from GitHub Releases
- 🌐 **Web Chat** - Embedded chat window with WebView2
- 📊 **Live Status** - Real-time sessions, channels, and usage display
- 🧭 **Command Center** - Dense gateway, channel, usage, node, pairing, and allowlist diagnostics from one window
- ⚡ **Activity Stream** - Command Center page for live session, usage, node, and notification events
- 🔔 **Toast Notifications** - Clickable Windows notifications with [smart categorization](docs/NOTIFICATION_CATEGORIZATION.md)
- 📡 **Channel Control** - Start/stop Telegram & WhatsApp from the menu
- 🖥️ **Node Observability** - Node inventory with online/offline state and copyable summary
- ⏱ **Cron Jobs** - Quick access to scheduled tasks
- 🚀 **Auto-start** - Launch with Windows
- ⚙️ **Settings** - Full configuration page
- 🎯 **First-run onboarding** — native WSL gateway setup with capability, permission, install, onboard, and completion screens

#### Quick Send scope requirement

Quick Send uses the gateway `chat.send` method and requires the operator device to have `operator.write` scope.

If Quick Send fails with `missing scope: operator.write`, Nemo now copies identity + remediation guidance to your clipboard, including:

- operator role and `client.id` used by the tray app
- gateway-reported operator device id (if provided)
- currently granted scopes (if provided)

For this specific error (`missing scope: operator.write`), the cause is an **operator token scope issue**. Update the token used by the tray app so it includes `operator.write`, then retry Quick Send.

If Quick Send fails with `pairing required` / `NOT_PAIRED`, that is a **device approval** issue. Approve the tray device in gateway pairing approvals, reconnect, and retry.

### Menu Sections
- **Status** - Gateway connection status with click-to-view details
- **Command Center** - Hub with diagnostics, channel health, usage, sessions, nodes, and copyable repair commands
- **Sessions** - Active agent sessions with preview and per-session controls
- **Usage** - Provider/cost summary with quick jump to activity details
- **Channels** - Telegram/WhatsApp status with toggle control
- **Nodes** - Online/offline node inventory and copyable summary
- **Recent Activity** - Timestamped event stream for sessions, usage, nodes, and notifications
- **Actions** - Dashboard, Web Chat, Quick Send, Activity Stream, History
- **Support & Debug** - Logs, config, diagnostics folder, redacted support context, browser setup, port/capability/node/channel/activity summaries, and managed SSH tunnel restart
- **Settings** - Configuration and auto-start

### Mac Parity Status

Comparing against [openclaw-menubar](https://github.com/magimetal/openclaw-menubar) (macOS Swift menu bar app):

| Feature | Mac | Windows | Notes |
|---------|-----|---------|-------|
| Menu bar/tray icon | ✅ | ✅ | Color-coded status |
| Gateway status display | ✅ | ✅ | Connected/Disconnected |
| PID display | ✅ | ✅ | Command Center shows gateway listener process/PID |
| Channel status | ✅ | ✅ | Mac: Discord / Win: Telegram+WhatsApp |
| Sessions count | ✅ | ✅ | |
| Last check timestamp | ✅ | ✅ | Shown in tray tooltip |
| Gateway start/stop/restart | ✅ | ⚠️ | Windows can restart the managed SSH tunnel from tray Support & Debug and Command Center; external gateway process control is not implemented |
| View Logs | ✅ | ✅ | |
| Open Web UI | ✅ | ✅ | |
| Refresh | ✅ | ✅ | Auto-refresh on menu open |
| Launch at Login | ✅ | ✅ | |
| Notifications toggle | ✅ | ✅ | |

### Windows-Only Features

These features are available in Windows but not in the Mac app:

| Feature | Description |
|---------|-------------|
| Quick Send hotkey | Ctrl+Alt+Shift+C global hotkey |
| Embedded Web Chat | WebView2-based chat window |
| Toast notifications | Clickable Windows notifications |
| Channel control | Start/stop Telegram & WhatsApp |
| Modern flyout menu | Windows 11-style with dark/light mode |
| Deep links | `luckynemo://` URL scheme with IPC |
| First-run onboarding | Native setup flow: Security notice → Welcome/Advanced → Capabilities and permissions → Install progress → LuckyNemo onboard → Complete |

### 🔌 Node Mode (Agent Control)

If the operator/node split is new to you, read [Operator and node concepts](docs/OPERATOR_NODE_CONCEPTS.md) before enabling Node Mode.

When Node Mode is enabled in Settings, your Windows PC becomes a **node** that the LuckyNemo agent can control - just like the Mac app! The agent can:

| Capability | Commands | Description |
|------------|----------|-------------|
| **System** | `system.notify`, `system.run`, `system.run.prepare`, `system.which`, `system.execApprovals.get`, `system.execApprovals.set` | Show Windows toast notifications, execute commands with policy controls |
| **Canvas** | `canvas.present`, `canvas.hide`, `canvas.navigate`, `canvas.eval`, `canvas.snapshot`, `canvas.a2ui.push`, `canvas.a2ui.pushJSONL`, `canvas.a2ui.reset` | Display and control a WebView2 window |
| **Screen** | `screen.snapshot`, `screen.record` | Capture screenshots and fixed-duration MP4 screen recordings |
| **Camera** | `camera.list`, `camera.snap`, `camera.clip` | Enumerate cameras and capture still photos or short video clips |
| **Speech-to-text** | `stt.transcribe` | Capture audio from the default microphone for a bounded duration and return transcribed text. Default-off; opt-in via Settings. When enabled, advertised to both gateway callers (subject to gateway allowlist) and local MCP clients (subject to bearer token). |
| **Location** | `location.get` | Return Windows geolocation when permission is available |
| **Device** | `device.info`, `device.status` | Return Windows host/app metadata and lightweight status |
| **Text-to-speech** | `tts.speak` | Speak text aloud through Windows speech synthesis, or ElevenLabs when configured |

Packaged installs declare camera, microphone, and location capabilities. Windows may ask for consent the first time a node capability uses one of those protected resources.

#### Node Setup

1. **Enable Node Mode** in Settings (enabled by default)
2. **First connection** creates a pairing request on the gateway
3. **Approve the device** on your gateway:
   ```bash
   luckynemo devices list          # Find your Windows device
   luckynemo devices approve <id>  # Approve it
   ```
4. **Configure gateway allowCommands** - Add the commands you want to allow under `gateway.nodes` in `~/.luckynemo/luckynemo.json`:
   ```json
   {
     "gateway": {
       "nodes": {
         "allowCommands": [
           "system.notify",
           "system.run",
           "system.run.prepare",
           "system.which",
           "system.execApprovals.get",
           "system.execApprovals.set",
           "canvas.present",
           "canvas.hide",
           "canvas.navigate",
           "canvas.eval",
           "canvas.snapshot",
           "canvas.a2ui.push",
           "canvas.a2ui.pushJSONL",
           "canvas.a2ui.reset",
           "screen.snapshot",
           "camera.list",
           "camera.snap",
           "camera.clip",
           "location.get",
           "device.info",
           "device.status",
           "tts.speak"
         ]
       }
     }
   }
   ```
    > ⚠️ **Important**: The gateway has a server-side allowlist. Commands must be listed explicitly - wildcards like `canvas.*` don't work! Privacy-sensitive commands such as `screen.record` and agent-driven audio playback via `tts.speak` should only be added to `allowCommands` when you explicitly want to allow them.

5. **Test it** from your Mac/gateway:
   ```bash
    # Show a notification
    luckynemo nodes notify --node <id> --title "Hello" --body "From Mac!"
    
    # Open a canvas window
    luckynemo nodes canvas present --node <id> --url "https://example.com"
    
    # Execute JavaScript (note: CLI sends "javaScript" param)
    luckynemo nodes canvas eval --node <id> --javaScript "document.title"
    
    # Render A2UI JSONL in the canvas (pass the file contents as a string)
    luckynemo nodes canvas a2ui push --node <id> --jsonl "$(cat ./ui.jsonl)"
    
    # Take a screenshot
    luckynemo nodes invoke --node <id> --command screen.snapshot --params '{"screenIndex":0,"format":"png"}'

    # Record a short screen clip (requires explicitly allowing screen.record on the gateway)
    luckynemo nodes screen record --node <id> --duration 3000 --fps 10 --screen 0 --no-audio --out /tmp/luckynemo-windows-screen-record-test.mp4 --json

    # List cameras
    luckynemo nodes invoke --node <id> --command camera.list

    # Take a photo (NV12/MediaCapture fallback)
    luckynemo nodes invoke --node <id> --command camera.snap --params '{"deviceId":"<device-id>","format":"jpeg","quality":80}'

    # Speak text aloud on the Windows node (requires TTS enabled in Settings and tts.speak allowed on the gateway)
    luckynemo nodes invoke --node <id> --command tts.speak --params '{"text":"Hello from LuckyNemo","provider":"windows"}'

    # Execute a command on the Windows node
    luckynemo nodes invoke --node <id> --command system.run --params '{"command":"Get-Process | Select -First 5","shell":"powershell","timeoutMs":10000}'

    # View exec approval policy
    luckynemo nodes invoke --node <id> --command system.execApprovals.get

    # Update exec approval policy (add custom rules)
    luckynemo nodes invoke --node <id> --command system.execApprovals.set --params '{"rules":[{"pattern":"echo *","action":"allow"},{"pattern":"*","action":"deny"}],"defaultAction":"deny"}'
    ```
    > 📷 **Camera permission**: Desktop builds rely on Windows Privacy settings. Packaged MSIX builds will show the system consent prompt.
    
    > 🔒 **Exec Policy**: `system.run` is gated by an approval policy on the Windows node at `%LOCALAPPDATA%\LuckyNemoTray\exec-policy.json` (schema: `{ "defaultAction": "...", "rules": [...] }`). This is separate from gateway-side `~/.luckynemo/exec-approvals.json`.
    >
    > Rules are matched against the full command line. Known wrapper payloads such as `cmd /c ...`, `powershell -Command ...`, `pwsh -EncodedCommand ...`, and `bash -c ...` are also evaluated before execution. Dangerous environment overrides like `PATH`, `PATHEXT`, `NODE_OPTIONS`, `GIT_SSH_COMMAND`, `LD_*`, and `DYLD_*` are rejected.

#### Command Center diagnostics

Open the status detail/Command Center from the tray menu or with `luckynemo://commandcenter`. It shows:

- channel health from gateway `health` events, including node-mode health received without a separate operator connection
- active sessions, usage/cost data, node inventory, declared commands, and Mac parity notes
- allowlist diagnostics that separate safe companion commands from privacy-sensitive opt-ins like `screen.record`, `camera.snap`, and `camera.clip`
- copyable repair commands for safe allowlist fixes and pending pairing approval
- recent activity and node invoke results through the Activity Stream, storing command names/status/duration only (not payloads, screenshots, recordings, or secrets)
    >
    > ```bash
    > luckynemo nodes invoke --node <id> --command system.execApprovals.set --params '{"rules":[{"pattern":"powershell.exe","action":"allow"},{"pattern":"pwsh.exe","action":"allow"},{"pattern":"echo *","action":"allow"},{"pattern":"*","action":"deny"}],"defaultAction":"deny"}'
    > ```

    > 🔐 **Web Chat secure context**: Remote web chat requires `https://` (or localhost). If using a self-signed cert, trust it in Windows (Trusted Root Certification Authorities) or use an SSH tunnel to localhost.

#### Node Status in Tray Menu

The tray menu shows node connection status:
- **🔌 Node Mode** section appears when enabled
- **⏳ Waiting for approval...** - Device needs approval on gateway
- **✅ Paired & Connected** - Ready to receive commands
- Click the device ID to copy it for the approval command

### Deep Links

LuckyNemo registers the `luckynemo://` URL scheme for automation and integration:

| Link | Description |
|------|-------------|
| `luckynemo://settings` | Open the Settings page |
| `luckynemo://setup` | Open Setup Wizard |
| `luckynemo://chat` | Open the Chat page |
| `luckynemo://commandcenter` | Open Command Center diagnostics |
| `luckynemo://activity` | Open the Activity page |
| `luckynemo://history` | Open the Activity page filtered to notification history |
| `luckynemo://dashboard` | Open Dashboard in browser |
| `luckynemo://dashboard/sessions` | Open specific dashboard page |
| `luckynemo://dashboard/channels` | Open Channels dashboard page |
| `luckynemo://dashboard/skills` | Open Skills dashboard page |
| `luckynemo://dashboard/cron` | Open Cron dashboard page |
| `luckynemo://healthcheck` | Run a manual health check |
| `luckynemo://check-updates` | Run a manual update check |
| `luckynemo://logs` | Open the current tray log file |
| `luckynemo://log-folder` | Open the logs folder |
| `luckynemo://config` | Open the config folder |
| `luckynemo://diagnostics` | Open the diagnostics JSONL folder |
| `luckynemo://support-context` | Copy redacted support context |
| `luckynemo://debug-bundle` | Copy a combined debug bundle for support |
| `luckynemo://browser-setup` | Copy browser.proxy/browser-control setup guidance |
| `luckynemo://port-diagnostics` | Copy gateway/browser/tunnel port diagnostics with owner PID stop hints |
| `luckynemo://capability-diagnostics` | Copy permissions, allowlist, and parity diagnostics |
| `luckynemo://node-inventory` | Copy node capabilities, commands, and policy status |
| `luckynemo://channel-summary` | Copy channel health and start/stop availability |
| `luckynemo://activity-summary` | Copy recent tray activity for troubleshooting |
| `luckynemo://extensibility-summary` | Copy channel, skills, and cron dashboard surface guidance |
| `luckynemo://restart-ssh-tunnel` | Restart the tray-managed SSH tunnel when enabled |
| `luckynemo://send?message=Hello` | Open Quick Send with pre-filled text |
| `luckynemo://agent?message=Hello` | Send message directly to the connected gateway |

Deep links work even when Nemo is already running - they're forwarded via IPC.

## 📦 LuckyNemo.Shared

Shared library containing:
- `LuckyNemoGatewayClient` - WebSocket client for gateway protocol
- `ILuckyNemoLogger` - Logging interface
- Data models (SessionInfo, ChannelHealth, etc.)
- Channel control (start/stop channels via gateway)

## Development

### Project Structure

See [DEVELOPMENT.md](DEVELOPMENT.md#project-structure) for the complete and current `src/` and `tests/` project inventory.

### Configuration

Settings are stored in:
- Settings: `%APPDATA%\LuckyNemoTray\settings.json`
- Logs: `%LOCALAPPDATA%\LuckyNemoTray\luckynemo-tray.log`
- Easy-button setup summary: `%LOCALAPPDATA%\LuckyNemoTray\Logs\Setup\easy-setup-latest.txt`
- Easy-button setup JSONL: `%LOCALAPPDATA%\LuckyNemoTray\Logs\Setup\easy-setup-latest.jsonl`

Default gateway: `ws://localhost:18789`

### First Run

On first run, Nemo launches a guided setup flow:

1. **Security notice** — confirms this is a trusted PC before local setup starts.
2. **Welcome** — choose **Install a local gateway (WSL)** or connect to an existing gateway from Connections.
3. **Capabilities** — choose a profile, review matching Windows permission status, and see exactly what setup will install.
4. **Progress** — installs the app-owned `LuckyNemoGateway` WSL instance and keeps Live activity available but collapsed by default.
5. **Gateway installed** — confirms the WSL gateway is running before moving into LuckyNemo onboard.
6. **LuckyNemo onboard** — gateway-driven provider/model/key setup rendered as a transcript.
7. **All set** — summary of available features, startup preference, and Finish.

For detailed setup instructions, see [docs/SETUP.md](docs/SETUP.md). For the full onboarding architecture, see [docs/ONBOARDING_WIZARD.md](docs/ONBOARDING_WIZARD.md).

## License

MIT License - see [LICENSE](LICENSE)

---

