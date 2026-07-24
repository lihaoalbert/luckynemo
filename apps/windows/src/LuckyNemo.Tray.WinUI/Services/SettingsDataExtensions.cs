using LuckyNemo.Connection;
using LuckyNemo.Shared;

namespace LuckyNemoTray.Services;

public static class SettingsDataExtensions
{
    public static ConnectionSettingsSnapshot ToConnectionSnapshot(this SettingsData settings) => new(
        settings.GatewayUrl,
        settings.UseSshTunnel,
        settings.SshTunnelUser,
        settings.SshTunnelHost,
        settings.SshTunnelSshPort,
        settings.SshTunnelRemotePort,
        settings.SshTunnelLocalPort,
        settings.EnableNodeMode,
        settings.EnableMcpServer,
        settings.NodeCanvasEnabled,
        settings.NodeScreenEnabled,
        settings.NodeCameraEnabled,
        settings.NodeLocationEnabled,
        settings.NodeBrowserProxyEnabled,
        settings.NodeSttEnabled,
        settings.NodeTtsEnabled,
        settings.NodeSystemRunEnabled,
        settings.ToJson());
}
