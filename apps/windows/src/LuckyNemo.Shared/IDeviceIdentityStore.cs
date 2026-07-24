namespace LuckyNemo.Shared;

/// <summary>
/// Interface for storing device tokens to the identity file.
/// Decouples token persistence from the gateway/node clients.
/// </summary>
public interface IDeviceIdentityStore
{
    /// <summary>Store a device token for the given role at the specified identity path.</summary>
    void StoreToken(string identityPath, string token, string[]? scopes, string role);
}

/// <summary>
/// Production implementation that delegates to <see cref="DeviceIdentity"/>.
/// </summary>
public sealed class DeviceIdentityFileStore : IDeviceIdentityStore
{
    private readonly ILuckyNemoLogger _logger;

    public DeviceIdentityFileStore(ILuckyNemoLogger? logger = null)
    {
        _logger = logger ?? NullLogger.Instance;
    }

    public void StoreToken(string identityPath, string token, string[]? scopes, string role)
    {
        var identity = new DeviceIdentity(identityPath, _logger);
        identity.Initialize();
        identity.StoreDeviceTokenForRole(role, token, scopes);
    }
}
