namespace LuckyNemo.Shared.Telemetry;

public enum LuckyNemoResourceName
{
    WindowsTray,
    WindowsNode
}

/// <summary>
/// Stable resource names used by LuckyNemo telemetry exporters.
/// </summary>
public static class LuckyNemoResourceNames
{
    public static string ToServiceName(this LuckyNemoResourceName resource) =>
        resource switch
        {
            LuckyNemoResourceName.WindowsTray => "luckynemo-windows-tray",
            LuckyNemoResourceName.WindowsNode => "luckynemo-windows-node",
            _ => throw new ArgumentOutOfRangeException(nameof(resource), resource, "Unknown LuckyNemo resource name.")
        };
}
