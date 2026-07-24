# Security Policy

If you believe you have found a security issue in LuckyNemo Windows, report it privately first.

Do not open a public issue or pull request that discloses an unpatched vulnerability, exploit path, secret, or security-sensitive proof of concept.

## Reporting

For vulnerabilities in this repository, submit a private GitHub Security Advisory for [luckynemo/luckynemo-windows-node](https://github.com/lihaoalbert/LuckyNemo/security/advisories/new) when available.

If the issue does not fit this repository or you are unsure where it belongs, email [security@luckynemo.ai](mailto:security@luckynemo.ai) and we will route it.

Useful reports include:

- affected version or commit SHA,
- impacted component or file path,
- reproduction steps or a proof of concept against latest `main`,
- actual impact and the LuckyNemo trust boundary crossed,
- Windows version and architecture,
- suggested remediation when practical.

Reports without reproduction steps, demonstrated impact, and remediation advice may be deprioritized.

## Scope

Security-relevant surfaces in this repository include:

- Windows tray pairing, credential storage, and gateway connection behavior,
- node command execution, approval policy, screen, camera, audio, notification, and canvas capabilities,
- local setup, installer, update, uninstall, and PowerToys Command Palette flows,
- deep links, IPC, WebView, and local file handling,
- GitHub Actions, dependency automation, and release packaging.

## Out of Scope

The following are usually out of scope for this repository:

- issues in LuckyNemo core, bundled plugins, channels, or gateway behavior that must be fixed in [luckynemo/luckynemo](https://github.com/lihaoalbert/LuckyNemo),
- vulnerabilities in upstream Windows, .NET, WinUI, PowerToys, or third-party packages without reachable impact through LuckyNemo Windows,
- prompt injection by itself, unless it demonstrates a concrete auth, approval, sandbox, command-policy, or local-boundary bypass,
- reports that require prior write access to trusted local state such as `%APPDATA%\LuckyNemoTray`, `%LOCALAPPDATA%\LuckyNemoTray`, project files, shell profile files, or installed binaries,
- insecure local machine administration or multi-user host setups where the OS trust boundary is already lost,
- scanner-only findings without a working reproduction and demonstrated LuckyNemo Windows impact.

If the issue is actually in LuckyNemo core, report it to [luckynemo/luckynemo](https://github.com/lihaoalbert/LuckyNemo/security/advisories/new). For broader LuckyNemo reporting guidance, see [https://trust.luckynemo.ai](https://trust.luckynemo.ai).

## Trust Boundaries

LuckyNemo Windows assumes the local Windows account and machine running it are trusted.

- Gateway and device credentials are local user secrets.
- Node capabilities run with the current user's Windows privileges unless an explicit platform boundary applies.
- Approved commands and trusted local configuration are operator-controlled state.
- Shared-machine or adversarial multi-user setups should use separate OS users, devices, or gateway instances.

Reports should show how an untrusted input crosses one of those boundaries.
