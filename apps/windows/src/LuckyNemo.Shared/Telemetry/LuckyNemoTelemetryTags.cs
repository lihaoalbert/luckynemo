namespace LuckyNemo.Shared.Telemetry;

public enum LuckyNemoTelemetryTagKey
{
    Source,
    Outcome,
    ErrorCategory,
    ErrorType,
    Reason,
    Status
}

/// <summary>
/// Stable tag keys used by LuckyNemo instrumentation.
/// </summary>
public static class LuckyNemoTelemetryTags
{
    public static string ToTelemetryName(this LuckyNemoTelemetryTagKey key) =>
        key switch
        {
            LuckyNemoTelemetryTagKey.Source => "luckynemo.source",
            LuckyNemoTelemetryTagKey.Outcome => "luckynemo.outcome",
            LuckyNemoTelemetryTagKey.ErrorCategory => "luckynemo.error.category",
            LuckyNemoTelemetryTagKey.ErrorType => "error.type",
            LuckyNemoTelemetryTagKey.Reason => "luckynemo.reason",
            LuckyNemoTelemetryTagKey.Status => "luckynemo.status",
            _ => throw new ArgumentOutOfRangeException(nameof(key), key, "Unknown LuckyNemo telemetry tag key.")
        };
}
