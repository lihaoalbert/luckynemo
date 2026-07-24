using LuckyNemo.Shared;

namespace LuckyNemo.Connection;

/// <summary>
/// Wraps <see cref="LuckyNemoGatewayClient"/> behind <see cref="IGatewayClientLifecycle"/>.
/// Creates a real WebSocket-connected client instance.
/// </summary>
public sealed class GatewayClientFactory : IGatewayClientFactory
{
    public IGatewayClientLifecycle Create(
        string gatewayUrl,
        GatewayCredential credential,
        string identityPath,
        ILuckyNemoLogger logger)
    {
        var client = new LuckyNemoGatewayClient(
            gatewayUrl,
            credential.Token,
            logger,
            tokenIsBootstrapToken: credential.IsBootstrapToken,
            bootstrapPairAsNode: false,
            identityPath: identityPath);

        return new GatewayClientLifecycleAdapter(client);
    }
}

/// <summary>
/// Adapts <see cref="LuckyNemoGatewayClient"/> (which inherits from
/// <see cref="WebSocketClientBase"/>) to the <see cref="IGatewayClientLifecycle"/> interface.
/// </summary>
internal sealed class GatewayClientLifecycleAdapter : IGatewayClientLifecycle
{
    private readonly LuckyNemoGatewayClient _client;

    public GatewayClientLifecycleAdapter(LuckyNemoGatewayClient client)
    {
        _client = client;
        // Forward events from WebSocketClientBase
        _client.StatusChanged += (s, e) => StatusChanged?.Invoke(this, e);
        _client.AuthenticationFailed += (s, e) => AuthenticationFailed?.Invoke(this, e);
    }

    public LuckyNemoGatewayClient DataClient => _client;

    public event EventHandler<ConnectionStatus>? StatusChanged;
    public event EventHandler<string>? AuthenticationFailed;

    public Task ConnectAsync(CancellationToken ct) => _client.ConnectAsync();

    public void Dispose() => _client.Dispose();
}
