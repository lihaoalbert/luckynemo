using System.Diagnostics;

namespace LuckyNemo.Shared.Telemetry;

public enum LuckyNemoActivitySourceName
{
    LuckyNemo
}

/// <summary>
/// Stable ActivitySource names used by LuckyNemo instrumentation.
/// </summary>
public static class LuckyNemoActivitySources
{
    public static ActivitySource LuckyNemoSource { get; } = new(LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName());

    public static string ToTelemetryName(this LuckyNemoActivitySourceName source) =>
        source switch
        {
            LuckyNemoActivitySourceName.LuckyNemo => "luckynemo",
            _ => throw new ArgumentOutOfRangeException(nameof(source), source, "Unknown LuckyNemo activity source.")
        };

    internal static ActivitySource ToActivitySource(this LuckyNemoActivitySourceName source) =>
        source switch
        {
            LuckyNemoActivitySourceName.LuckyNemo => LuckyNemoSource,
            _ => throw new ArgumentOutOfRangeException(nameof(source), source, "Unknown LuckyNemo activity source.")
        };
}
