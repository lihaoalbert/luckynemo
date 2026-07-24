using System;
using Xunit;

namespace LuckyNemo.Tray.IntegrationTests;

/// <summary>
/// Black-box integration tests that spawn the tray app as a subprocess. Skipped
/// unless LUCKYNEMO_RUN_INTEGRATION=1 because they need a real Windows desktop
/// session (the WinUI3 app cannot run headless) and they pop UI windows / tray
/// icons during execution.
/// </summary>
public sealed class IntegrationFactAttribute : FactAttribute
{
    private const string EnvVar = "LUCKYNEMO_RUN_INTEGRATION";

    public IntegrationFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(EnvVar)))
        {
            Skip = $"Integration tests disabled. Set {EnvVar}=1 to enable.";
            return;
        }
        if (!OperatingSystem.IsWindows())
        {
            Skip = "Tray integration tests require Windows.";
        }
    }
}
