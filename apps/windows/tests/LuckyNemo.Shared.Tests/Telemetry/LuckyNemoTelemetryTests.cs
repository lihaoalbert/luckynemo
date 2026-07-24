using System.Collections.Concurrent;
using System.Diagnostics;
using System.Diagnostics.Metrics;
using LuckyNemo.Shared.Telemetry;

namespace LuckyNemo.Shared.Tests.Telemetry;

public sealed class LuckyNemoTelemetryTests
{
    [Fact]
    public void Constants_AreStable()
    {
        Assert.Equal("luckynemo", LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName());
        Assert.Equal("luckynemo", LuckyNemoActivitySources.LuckyNemoSource.Name);
        Assert.Equal("luckynemo", LuckyNemoMeterName.LuckyNemo.ToTelemetryName());
        Assert.Equal("luckynemo", LuckyNemoMeters.LuckyNemoMeter.Name);
        Assert.Equal("luckynemo-windows-tray", LuckyNemoResourceName.WindowsTray.ToServiceName());
        Assert.Equal("luckynemo-windows-node", LuckyNemoResourceName.WindowsNode.ToServiceName());
        Assert.Equal("luckynemo.source", LuckyNemoTelemetryTagKey.Source.ToTelemetryName());
        Assert.Equal("luckynemo.outcome", LuckyNemoTelemetryTagKey.Outcome.ToTelemetryName());
        Assert.Equal("luckynemo.error.category", LuckyNemoTelemetryTagKey.ErrorCategory.ToTelemetryName());
        Assert.Equal("luckynemo.reason", LuckyNemoTelemetryTagKey.Reason.ToTelemetryName());
        Assert.Equal("luckynemo.status", LuckyNemoTelemetryTagKey.Status.ToTelemetryName());
        Assert.Equal("error.type", LuckyNemoTelemetryTagKey.ErrorType.ToTelemetryName());
    }

    [Fact]
    public void Trace_NoListener_RunsActionAndReturnsResult()
    {
        var ran = false;

        var result = LuckyNemoTelemetry.Trace(
            "test.no_listener",
            () =>
            {
                ran = true;
                return 42;
            });

        Assert.True(ran);
        Assert.Equal(42, result);
    }

    [Fact]
    public void MarkHelpers_AreSafeForNullActivities()
    {
        var exception = new InvalidOperationException("boom");

        LuckyNemoTelemetry.MarkSuccess(null);
        LuckyNemoTelemetry.MarkCanceled(null);
        LuckyNemoTelemetry.MarkFailure(null, exception);
    }

    [Fact]
    public void StartActivity_WithListener_AllowsManualMarking()
    {
        using var collector = ActivityCollector.Listen(
            LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName(),
            "test.manual");
        using var activity = LuckyNemoTelemetry.StartActivity(
            "test.manual",
            [LuckyNemoTelemetryTag.String(LuckyNemoTelemetryTagKey.Source, "unit-test")]);

        LuckyNemoTelemetry.MarkSuccess(activity);

        Assert.NotNull(activity);
        Assert.Equal(ActivityStatusCode.Ok, activity.Status);
        Assert.Contains(activity.Tags, tag => tag.Key == LuckyNemoTelemetryTagKey.Source.ToTelemetryName() && tag.Value == "unit-test");
        Assert.Contains(activity.Tags, tag => tag.Key == LuckyNemoTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "success");
    }

    [Fact]
    public void StartDetachedActivity_PreservesAmbientActivity()
    {
        using var collector = ActivityCollector.Listen(
            LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName(),
            "test.detached");
        using var parent = new Activity("parent").Start();

        using var detached = LuckyNemoTelemetry.StartDetachedActivity("test.detached");

        Assert.NotNull(detached);
        Assert.Same(parent, Activity.Current);
    }

    [Fact]
    public void StartDetachedActivity_WithExplicitParent_CreatesChildAndPreservesAmbientActivity()
    {
        using var collector = ActivityCollector.Listen(
            LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName(),
            "test.parent",
            "test.child");
        using var ambient = new Activity("ambient").Start();
        using var parent = LuckyNemoTelemetry.StartDetachedActivity("test.parent");

        using var child = LuckyNemoTelemetry.StartDetachedActivity("test.child", parent!.Context);

        Assert.NotNull(child);
        Assert.Equal(parent.TraceId, child.TraceId);
        Assert.Equal(parent.SpanId, child.ParentSpanId);
        Assert.Same(ambient, Activity.Current);
    }

    [Fact]
    public void StartDetachedActivity_WithEmptyExplicitParent_CreatesRootAndPreservesAmbientActivity()
    {
        using var collector = ActivityCollector.Listen(
            LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName(),
            "test.root");
        using var ambient = new Activity("ambient").Start();

        using var root = LuckyNemoTelemetry.StartDetachedActivity(
            "test.root",
            default(ActivityContext));

        Assert.NotNull(root);
        Assert.Equal(default, root.ParentSpanId);
        Assert.NotEqual(ambient.TraceId, root.TraceId);
        Assert.Same(ambient, Activity.Current);
    }

    [Fact]
    public void StopDetachedActivity_PreservesNewerAmbientActivity()
    {
        using var collector = ActivityCollector.Listen(
            LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName(),
            "test.detached");
        using var original = new Activity("original").Start();
        var detached = LuckyNemoTelemetry.StartDetachedActivity("test.detached");
        using var newer = new Activity("newer").Start();

        LuckyNemoTelemetry.StopDetachedActivity(detached);

        Assert.NotNull(detached);
        Assert.True(detached!.IsStopped);
        Assert.Same(newer, Activity.Current);
    }

    [Fact]
    public void StopDetachedActivity_WithNull_IsSafe()
    {
        using var ambient = new Activity("ambient").Start();

        LuckyNemoTelemetry.StopDetachedActivity(null);

        Assert.Same(ambient, Activity.Current);
    }

    [Fact]
    public void Trace_WithListener_RecordsSuccessAndTags()
    {
        using var collector = ActivityCollector.Listen(
            LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName(),
            "test.success");

        LuckyNemoTelemetry.Trace(
            "test.success",
            () => { },
            [
                LuckyNemoTelemetryTag.String(LuckyNemoTelemetryTagKey.Source, "unit-test"),
                LuckyNemoTelemetryTag.String("luckynemo.test.exporter", "tray-otel")
            ]);

        var activity = Assert.Single(collector.Stopped);
        Assert.Equal("test.success", activity.OperationName);
        Assert.Equal(ActivityStatusCode.Ok, activity.Status);
        Assert.Contains(activity.Tags, tag => tag.Key == LuckyNemoTelemetryTagKey.Source.ToTelemetryName() && tag.Value == "unit-test");
        Assert.Contains(activity.Tags, tag => tag.Key == "luckynemo.test.exporter" && tag.Value == "tray-otel");
        Assert.Contains(activity.Tags, tag => tag.Key == LuckyNemoTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "success");
    }

    [Fact]
    public void Trace_Exception_MarksErrorAndRethrowsOriginal()
    {
        using var collector = ActivityCollector.Listen(
            LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName(),
            "test.error");
        var expected = new InvalidOperationException("boom");

        var thrown = Assert.Throws<InvalidOperationException>(() =>
            LuckyNemoTelemetry.Trace("test.error", () => throw expected));

        Assert.Same(expected, thrown);
        var activity = Assert.Single(collector.Stopped);
        Assert.Equal(ActivityStatusCode.Error, activity.Status);
        Assert.Equal(nameof(InvalidOperationException), activity.StatusDescription);
        Assert.Contains(activity.Tags, tag => tag.Key == LuckyNemoTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "failure");
        Assert.Contains(
            activity.Tags,
            tag => tag.Key == LuckyNemoTelemetryTagKey.ErrorType.ToTelemetryName() && tag.Value == typeof(InvalidOperationException).FullName);
    }

    [Fact]
    public async Task TraceAsync_WithListener_RecordsSuccessAndReturnsResult()
    {
        using var collector = ActivityCollector.Listen(
            LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName(),
            "test.async.success");

        var result = await LuckyNemoTelemetry.TraceAsync(
            "test.async.success",
            _ => Task.FromResult("ok"));

        Assert.Equal("ok", result);
        var activity = Assert.Single(collector.Stopped);
        Assert.Equal("test.async.success", activity.OperationName);
        Assert.Equal(ActivityStatusCode.Ok, activity.Status);
        Assert.Contains(activity.Tags, tag => tag.Key == LuckyNemoTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "success");
    }

    [Fact]
    public async Task TraceAsync_CanceledTask_MarksCanceledAndPreservesCancellation()
    {
        using var collector = ActivityCollector.Listen(
            LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName(),
            "test.async.cancel");
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAsync<TaskCanceledException>(() =>
            LuckyNemoTelemetry.TraceAsync(
                "test.async.cancel",
                token => Task.FromCanceled(token),
                cancellationToken: cts.Token));

        var activity = Assert.Single(collector.Stopped);
        Assert.Equal(ActivityStatusCode.Unset, activity.Status);
        Assert.Contains(activity.Tags, tag => tag.Key == LuckyNemoTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "canceled");
    }

    [Fact]
    public void Trace_OperationCanceled_MarksCanceledAndRethrowsOriginal()
    {
        using var collector = ActivityCollector.Listen(
            LuckyNemoActivitySourceName.LuckyNemo.ToTelemetryName(),
            "test.sync.cancel");
        var expected = new OperationCanceledException();

        var thrown = Assert.Throws<OperationCanceledException>(() =>
            LuckyNemoTelemetry.Trace("test.sync.cancel", () => throw expected));

        Assert.Same(expected, thrown);
        var activity = Assert.Single(collector.Stopped);
        Assert.Equal(ActivityStatusCode.Unset, activity.Status);
        Assert.Contains(activity.Tags, tag => tag.Key == LuckyNemoTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "canceled");
    }

    [Fact]
    public void StringTag_PreservesStringValues()
    {
        const string value = "diagnostic-label";

        var tag = LuckyNemoTelemetryTag.String(LuckyNemoTelemetryTagKey.Source, value);

        Assert.Equal(value, tag.Value);
    }

    [Fact]
    public void LocalStringTag_UsesLocalKey()
    {
        var tag = LuckyNemoTelemetryTag.String("luckynemo.test.local", "value");

        Assert.Equal("luckynemo.test.local", tag.Key);
        Assert.Equal("value", tag.Value);
    }

    [Fact]
    public void TelemetryTag_IsReferenceType_WithValidatedConstruction()
    {
        Assert.False(typeof(LuckyNemoTelemetryTag).IsValueType);
        Assert.Throws<ArgumentOutOfRangeException>(() => new LuckyNemoTelemetryTag((LuckyNemoTelemetryTagKey)999, "value"));
        Assert.Throws<ArgumentException>(() => LuckyNemoTelemetryTag.String("", "value"));
    }

    [Fact]
    public void CounterMetric_WithListener_RecordsMeasurementAndTags()
    {
        var metricName = $"test.counter.{Guid.NewGuid():N}";
        using var collector = MetricCollector.Listen(LuckyNemoMeterName.LuckyNemo.ToTelemetryName());
        var counter = LuckyNemoTelemetry.CreateCounter(metricName, unit: "{event}");

        LuckyNemoTelemetry.Add(
            counter,
            2,
            [
                LuckyNemoTelemetryTag.String(LuckyNemoTelemetryTagKey.Source, "unit-test"),
                LuckyNemoTelemetryTag.Number("luckynemo.test.count", 7)
            ]);

        var measurement = Assert.Single(collector.LongMeasurements, m => m.Name == metricName);
        Assert.Equal(2, measurement.Value);
        Assert.Contains(measurement.Tags, tag => tag.Key == LuckyNemoTelemetryTagKey.Source.ToTelemetryName() && (string?)tag.Value == "unit-test");
        Assert.Contains(measurement.Tags, tag => tag.Key == "luckynemo.test.count" && (long)tag.Value! == 7);
    }

    [Fact]
    public void HistogramMetric_WithListener_RecordsMeasurementAndTags()
    {
        var metricName = $"test.histogram.{Guid.NewGuid():N}";
        using var collector = MetricCollector.Listen(LuckyNemoMeterName.LuckyNemo.ToTelemetryName());
        var histogram = LuckyNemoTelemetry.CreateHistogram(metricName, unit: "ms");

        LuckyNemoTelemetry.Record(
            histogram,
            42.5,
            [LuckyNemoTelemetryTag.String(LuckyNemoTelemetryTagKey.Source, "unit-test")]);

        var measurement = Assert.Single(collector.DoubleMeasurements, m => m.Name == metricName);
        Assert.Equal(42.5, measurement.Value);
        Assert.Contains(measurement.Tags, tag => tag.Key == LuckyNemoTelemetryTagKey.Source.ToTelemetryName() && (string?)tag.Value == "unit-test");
    }

    [Fact]
    public void MarkFailure_RequiresException()
    {
        Assert.Throws<ArgumentNullException>(() => LuckyNemoTelemetry.MarkFailure(null, null!));
    }

    private sealed class ActivityCollector : IDisposable
    {
        private readonly ActivityListener _listener;

        private ActivityCollector(string sourceName, IReadOnlySet<string> operationNames)
        {
            _listener = new ActivityListener
            {
                ShouldListenTo = source => source.Name == sourceName,
                Sample = (ref ActivityCreationOptions<ActivityContext> options) =>
                    operationNames.Contains(options.Name)
                        ? ActivitySamplingResult.AllDataAndRecorded
                        : ActivitySamplingResult.None,
                ActivityStopped = activity =>
                {
                    if (operationNames.Contains(activity.OperationName))
                        Stopped.Enqueue(activity);
                }
            };
            ActivitySource.AddActivityListener(_listener);
        }

        public ConcurrentQueue<Activity> Stopped { get; } = new();

        public static ActivityCollector Listen(string sourceName, params string[] operationNames) =>
            new(sourceName, operationNames.ToHashSet(StringComparer.Ordinal));

        public void Dispose() => _listener.Dispose();
    }

    private sealed class MetricCollector : IDisposable
    {
        private readonly MeterListener _listener;

        private MetricCollector(string meterName)
        {
            _listener = new MeterListener
            {
                InstrumentPublished = (instrument, listener) =>
                {
                    if (instrument.Meter.Name == meterName)
                        listener.EnableMeasurementEvents(instrument);
                }
            };
            _listener.SetMeasurementEventCallback<long>((instrument, measurement, tags, _) =>
                LongMeasurements.Add(new MetricMeasurement<long>(instrument.Name, measurement, tags.ToArray())));
            _listener.SetMeasurementEventCallback<double>((instrument, measurement, tags, _) =>
                DoubleMeasurements.Add(new MetricMeasurement<double>(instrument.Name, measurement, tags.ToArray())));
            _listener.Start();
        }

        public List<MetricMeasurement<long>> LongMeasurements { get; } = new();
        public List<MetricMeasurement<double>> DoubleMeasurements { get; } = new();

        public static MetricCollector Listen(string meterName) => new(meterName);

        public void Dispose() => _listener.Dispose();
    }

    private sealed record MetricMeasurement<T>(
        string Name,
        T Value,
        KeyValuePair<string, object?>[] Tags);
}
