using System.Threading.Tasks;

namespace LuckyNemo.Shared.ExecApprovals;

/// <summary>
/// Seam for the V2 exec approval path. Implementations must be UI-free (no WinUI types).
/// Implementations decide whether a system.run request is allowed.
/// The NullHandler is the default; production wiring installs the real coordinator.
/// </summary>
public interface IExecApprovalV2Handler
{
    /// <param name="correlationId">Short identifier propagated through logging for this request.</param>
    Task<ExecApprovalV2Result> HandleAsync(LuckyNemo.Shared.NodeInvokeRequest request, string correlationId);
}
