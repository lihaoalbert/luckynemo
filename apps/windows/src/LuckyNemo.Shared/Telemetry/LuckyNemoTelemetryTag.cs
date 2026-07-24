namespace LuckyNemo.Shared.Telemetry;

/// <summary>
/// Explicit non-sensitive telemetry tag supplied by instrumentation call sites.
/// </summary>
public sealed class LuckyNemoTelemetryTag
{
    public LuckyNemoTelemetryTag(LuckyNemoTelemetryTagKey key, object? value)
        : this(key.ToTelemetryName(), value)
    {
    }

    private LuckyNemoTelemetryTag(string key, object? value)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new ArgumentException("Telemetry tag key cannot be empty.", nameof(key));

        (Key, Value) = (key, value);
    }

    public string Key { get; }
    public object? Value { get; }

    public static LuckyNemoTelemetryTag String(LuckyNemoTelemetryTagKey key, string? value) =>
        new(key, value);

    public static LuckyNemoTelemetryTag String(string localKey, string? value) =>
        new(localKey, value);

    public static LuckyNemoTelemetryTag Bool(LuckyNemoTelemetryTagKey key, bool value) =>
        new(key, value);

    public static LuckyNemoTelemetryTag Bool(string localKey, bool value) =>
        new(localKey, value);

    public static LuckyNemoTelemetryTag Number(LuckyNemoTelemetryTagKey key, long value) =>
        new(key, value);

    public static LuckyNemoTelemetryTag Number(string localKey, long value) =>
        new(localKey, value);
}
