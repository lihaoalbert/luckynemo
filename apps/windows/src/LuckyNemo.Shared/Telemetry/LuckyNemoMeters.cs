using System.Diagnostics.Metrics;

namespace LuckyNemo.Shared.Telemetry;

public enum LuckyNemoMeterName
{
    LuckyNemo
}

/// <summary>
/// Stable Meter names used by LuckyNemo metrics.
/// </summary>
public static class LuckyNemoMeters
{
    public static Meter LuckyNemoMeter { get; } = new(LuckyNemoMeterName.LuckyNemo.ToTelemetryName());

    public static string ToTelemetryName(this LuckyNemoMeterName meter) =>
        meter switch
        {
            LuckyNemoMeterName.LuckyNemo => "luckynemo",
            _ => throw new ArgumentOutOfRangeException(nameof(meter), meter, "Unknown LuckyNemo meter.")
        };

    internal static Meter ToMeter(this LuckyNemoMeterName meter) =>
        meter switch
        {
            LuckyNemoMeterName.LuckyNemo => LuckyNemoMeter,
            _ => throw new ArgumentOutOfRangeException(nameof(meter), meter, "Unknown LuckyNemo meter.")
        };
}
