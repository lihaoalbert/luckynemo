using Microsoft.Extensions.Logging;

namespace LuckyNemoTray.Services;

internal static class OpenTelemetryLogPolicy
{
    public const string TelemetryExporterCategory = "LuckyNemo.Telemetry.Exporter";
    public const string ConnectionCategory = "LuckyNemo.Telemetry.Connection";
    public const string NodeToolCategory = "LuckyNemo.Telemetry.NodeTool";

    public static bool ShouldExport(string? category, LogLevel level) =>
        level is >= LogLevel.Information and < LogLevel.None &&
        category is TelemetryExporterCategory or ConnectionCategory or NodeToolCategory;
}
