using LuckyNemoTray.Services;
using Xunit;

namespace LuckyNemo.Tray.Tests.Services;

public sealed class CaptureCancellationPolicyTests
{
    [Fact]
    public void CaptureFailure_RemainsPrimaryWhenCancellationRaces()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var captureFailure = new InvalidOperationException("camera hardware failed");

        var observed = Record.Exception(() => SimulateCaptureFinally(
            captureFailure,
            cancellation.Token));

        Assert.Same(captureFailure, observed);
    }

    [Fact]
    public void Cancellation_IsThrownWhenCaptureHasNoPrimaryFailure()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        Assert.Throws<OperationCanceledException>(() =>
            CaptureCancellationPolicy.ThrowIfCancellationRequested(
                primaryException: null,
                cancellation.Token));
    }

    private static void SimulateCaptureFinally(
        Exception captureFailure,
        CancellationToken cancellationToken)
    {
        Exception? primaryException = null;
        try
        {
            primaryException = captureFailure;
            throw captureFailure;
        }
        finally
        {
            CaptureCancellationPolicy.ThrowIfCancellationRequested(
                primaryException,
                cancellationToken);
        }
    }
}
