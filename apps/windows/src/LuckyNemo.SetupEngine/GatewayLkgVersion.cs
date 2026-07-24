namespace LuckyNemo.SetupEngine;

public static class GatewayLkgVersion
{
    // TODO(rebrand): luckynemo.ai is a placeholder. Point this at the real LuckyNemo
    // CLI install-script endpoint (upstream used https://openclaw.ai/install-cli.sh),
    // or set Gateway.InstallUrl in the setup config to your own script.
    public const string DefaultInstallUrl = "https://luckynemo.ai/install-cli.sh";
    // Tracks the `luckynemo` npm package version known-good with this app
    // (aligned with the LuckyNemo main repo release).
    public const string LkgVersion = "2026.7.2";

    public static string ResolveLkgVersion() => LkgVersion;

    public static void ApplyToConfig(SetupConfig config)
    {
        if (!string.IsNullOrWhiteSpace(config.Gateway.Version))
            return;

        if (!string.IsNullOrWhiteSpace(config.Gateway.InstallUrl) &&
            !string.Equals(config.Gateway.InstallUrl, DefaultInstallUrl, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        config.Gateway.Version = LkgVersion;
    }
}
