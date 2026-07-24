# Managing the locked-down WSL gateway

Local setup creates an app-owned WSL distro named `LuckyNemoGateway` by default. It is not a general-purpose Ubuntu profile: the gateway runs as the `luckynemo` Linux user, Windows interop is disabled inside WSL, Windows drive automounts are disabled inside WSL, and there is no password-based `sudo` flow.

Use these rules:

- Run normal gateway and config commands as `luckynemo`.
- Run sudo-style protected-file commands as `root` from Windows with `wsl.exe --user root`.
- Use double quotes around `bash -lc "..."`; single quotes do not work from Command Prompt.
- Do not edit through the Windows WSL share for this locked-down config; use a WSL shell as `luckynemo` instead.
- Do not edit the VHD or `%LOCALAPPDATA%\LuckyNemoTray\wsl` storage directly.

If your setup used a custom distro name, replace `LuckyNemoGateway` in the examples below.

## Check the managed distro

```powershell
# Lists WSL distros and shows whether LuckyNemoGateway is running.
wsl.exe --list --verbose

# Opens a one-shot shell as the gateway user and prints the user plus current directory.
wsl.exe -d LuckyNemoGateway --user luckynemo -- bash -lc "whoami && pwd"

# Opens a one-shot shell as root and prints root identity details.
wsl.exe -d LuckyNemoGateway --user root -- bash -lc "whoami && id"
```

## Update `luckynemo.json`

Most gateway configuration lives in:

```text
/home/luckynemo/.luckynemo/luckynemo.json
```

Because the distro is locked down, edit this file from inside WSL as the `luckynemo` user instead of editing it through the Windows filesystem share. The edit commands in this section intentionally change files; the inspection commands in the rest of this guide are read-only.

1. Open a shell as the gateway user:

   ```powershell
   # Opens an interactive shell as the gateway user.
   wsl.exe -d LuckyNemoGateway --user luckynemo -- bash
   ```

2. In that shell, back up and edit the config:

   ```bash
   # Moves into the LuckyNemo config directory.
   cd /home/luckynemo/.luckynemo

   # Creates a backup copy before editing.
   cp luckynemo.json luckynemo.json.bak

   # Opens luckynemo.json in the nano editor.
   nano luckynemo.json

   # Verifies that luckynemo.json is still valid JSON.
   python3 -m json.tool luckynemo.json > /dev/null
   ```

   If `nano` is not available, use `vi luckynemo.json`.

3. If the change does not take effect, reconnect or restart the gateway from LuckyNemo Companion.

Read-only checks for the config:

```powershell
# Shows ownership, permissions, size, and timestamp for luckynemo.json.
wsl.exe -d LuckyNemoGateway --user luckynemo -- bash -lc "ls -l /home/luckynemo/.luckynemo/luckynemo.json"

# Verifies that luckynemo.json is valid JSON without printing it.
wsl.exe -d LuckyNemoGateway --user luckynemo -- bash -lc "python3 -m json.tool /home/luckynemo/.luckynemo/luckynemo.json > /dev/null"

# Prints only the top-level config keys, not secret values.
wsl.exe -d LuckyNemoGateway --user luckynemo -- python3 -c "import json; data=json.load(open('/home/luckynemo/.luckynemo/luckynemo.json')); print('\n'.join(sorted(data.keys())))"
```

Do not paste or share the full `luckynemo.json` file. It can contain gateway tokens, private endpoints, provider settings, or other secrets; redact those values before sharing diagnostics.

## Inspect gateway state

Run gateway service checks as `luckynemo`:

```powershell
# Shows the user service status without paging; succeeds even if the service is inactive.
wsl.exe -d LuckyNemoGateway --user luckynemo -- bash -lc "systemctl --user status openclaw-gateway.service --no-pager || true"

# Shows the most recent gateway service journal entries without paging.
wsl.exe -d LuckyNemoGateway --user luckynemo -- bash -lc "journalctl --user-unit openclaw-gateway.service --no-pager -n 80 || true"

# Shows ownership and permissions for the app-owned gateway directories.
wsl.exe -d LuckyNemoGateway --user luckynemo -- bash -lc "ls -ld /home/luckynemo/.luckynemo /var/lib/luckynemo /var/log/luckynemo /opt/luckynemo"
```

Do not run `systemctl --user` as `root`; that checks root's user service manager, not the gateway's service.

## Inspect an optional Tailscale Serve endpoint

When the setup review enabled **Tailnet access with Tailscale Serve**, the generated distro runs its own Tailscale daemon. The Windows Companion intentionally uses the generated `wss://<node>.<tailnet>.ts.net` endpoint; it does not silently fall back to localhost.

Windows must also have Tailscale installed and signed in to the same tailnet. These checks do not print credentials:

```powershell
# Windows Companion side: confirm this PC is connected to Tailscale.
& "$env:ProgramFiles\Tailscale\tailscale.exe" status --json

# WSL side: confirm the daemon is connected and has a MagicDNS name.
wsl.exe -d LuckyNemoGateway --user root -- tailscale status --json

# Confirm Serve routes tailnet HTTPS to the loopback LuckyNemo gateway port.
# Tailscale lifecycle and Serve are intentionally owned by root, not luckynemo.
wsl.exe -d LuckyNemoGateway --user root -- /usr/bin/tailscale serve status --json

# Funnel is unsupported. This must show no public route.
wsl.exe -d LuckyNemoGateway --user root -- /usr/bin/tailscale funnel status --json

# Check the LuckyNemo gateway itself; it remains loopback-bound inside WSL.
wsl.exe -d LuckyNemoGateway --user luckynemo -- bash -lc "systemctl --user status openclaw-gateway.service --no-pager || true"
```

The generated WSL distro is Ubuntu 24.04 (noble). Tailscale Serve setup requires that exact generated distro and rejects another `BaseDistro` before replacing an existing gateway. Setup installs Tailscale from its signed stable APT repository rather than executing the mutable `install.sh` bootstrap script as root.

Tailscale Serve preserves Companion token and device authentication by default (`gateway.auth.allowTailscale=false`). Setup runs `tailscale up`, Serve, reset, logout, and daemon management as root; the `luckynemo` account is never made a Tailscale operator. Tailscale's LocalAPI permits read-only operations, such as identity lookup, to local unprivileged clients while reserving mutation for root or an explicitly configured operator. In the setup review, **Trust Tailscale identities for gateway authentication** is an explicit opt-in; when enabled, verified Tailscale identity headers and tailnet ACLs become part of the gateway access-control boundary. Token and device credentials remain available for Companion pairing and compatibility. Do not enable Funnel for this generated gateway: this workflow supports private tailnet Serve only.

## Use root instead of sudo

There is no interactive sudo password prompt. Open a root shell only when you intentionally need to inspect or change protected files:

```powershell
# Opens an interactive root shell for intentional protected-file work.
wsl.exe -d LuckyNemoGateway --user root -- bash
```

Keep gateway-owned files under `/home/luckynemo/.luckynemo`, `/var/lib/luckynemo`, `/var/log/luckynemo`, and `/opt/luckynemo` owned by `luckynemo:luckynemo`.
