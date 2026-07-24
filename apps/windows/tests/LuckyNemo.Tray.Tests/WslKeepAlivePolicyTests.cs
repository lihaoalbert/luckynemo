using LuckyNemo.Connection;
using LuckyNemoTray.Services;

namespace LuckyNemo.Tray.Tests;

public class WslKeepAlivePolicyTests
{
    [Fact]
    public void ShouldStart_UsesActiveLocalRegistryRecord_WhenLegacySettingsAreEmpty()
    {
        var record = new GatewayRecord
        {
            Id = "local",
            Url = "ws://localhost:18789",
            IsLocal = true,
            SetupManagedDistroName = "LuckyNemoGateway",
        };

        Assert.True(WslKeepAlivePolicy.ShouldStart(record, legacyGatewayUrl: null));
    }

    [Fact]
    public void ShouldStart_UsesAppOwnedTailscaleRegistryRecord()
    {
        var record = new GatewayRecord
        {
            Id = "tailscale",
            Url = "wss://luckynemo.tailnet.ts.net",
            IsLocal = true,
            SetupManagedDistroName = "LuckyNemoGateway",
        };

        Assert.True(WslKeepAlivePolicy.ShouldStart(record, legacyGatewayUrl: null));
        Assert.True(WslKeepAlivePolicy.HasSetupManagedLocalGateway([record]));
    }

    [Fact]
    public void ShouldStart_DoesNotFallBackToLegacyLocalUrl_WhenActiveRecordIsRemote()
    {
        var record = new GatewayRecord
        {
            Id = "remote",
            Url = "wss://gateway.example.test",
            IsLocal = false,
        };

        Assert.False(WslKeepAlivePolicy.ShouldStart(record, "ws://localhost:18789"));
    }

    [Fact]
    public void ShouldStart_DoesNotTreatSshTunnelLocalForwardAsWslGateway()
    {
        var record = new GatewayRecord
        {
            Id = "ssh",
            Url = "ws://127.0.0.1:18789",
            IsLocal = true,
            SshTunnel = new SshTunnelConfig("user", "example.test", 18789, 18789),
        };

        Assert.False(WslKeepAlivePolicy.ShouldStart(record, legacyGatewayUrl: null));
    }

    [Fact]
    public void ShouldStart_FallsBackToLegacyLocalUrl_WhenNoActiveRecordExists()
    {
        Assert.True(WslKeepAlivePolicy.ShouldStart(activeRecord: null, "ws://127.0.0.1:18789"));
    }

    [Fact]
    public void ResolveDistroName_PrefersRegistryManagedDistro()
    {
        var record = new GatewayRecord
        {
            Id = "local",
            Url = "ws://localhost:18789",
            IsLocal = true,
            SetupManagedDistroName = "RegistryGateway",
        };

        var distroName = WslKeepAlivePolicy.ResolveDistroName(
            record,
            setupStateDistroName: "SetupStateGateway",
            environmentOverride: "EnvGateway");

        Assert.Equal("RegistryGateway", distroName);
    }

    [Fact]
    public void HasSetupManagedLocalGateway_ReturnsTrueForSetupManagedLocalRecord()
    {
        var records = new[]
        {
            new GatewayRecord
            {
                Id = "local",
                Url = "ws://localhost:18789",
                IsLocal = true,
                SetupManagedDistroName = "LuckyNemoGateway",
            },
        };

        Assert.True(WslKeepAlivePolicy.HasSetupManagedLocalGateway(records));
    }

    [Fact]
    public void HasSetupManagedLocalGateway_ReturnsTrueForLegacyDefaultSetupManagedLocalRecord()
    {
        var records = new[]
        {
            new GatewayRecord
            {
                Id = "legacy-local",
                Url = "ws://localhost:18789",
                FriendlyName = "Local (LuckyNemoGateway)",
                IsLocal = true,
            },
        };

        Assert.True(WslKeepAlivePolicy.HasSetupManagedLocalGateway(records));
    }

    [Fact]
    public void HasSetupManagedLocalGateway_ReturnsFalseForManualLocalRecord()
    {
        var records = new[]
        {
            new GatewayRecord
            {
                Id = "manual-local",
                Url = "ws://localhost:18789",
                IsLocal = true,
            },
        };

        Assert.False(WslKeepAlivePolicy.HasSetupManagedLocalGateway(records));
    }

    [Fact]
    public void HasSetupManagedLocalGateway_ReturnsFalseForSshTunnelRecord()
    {
        var records = new[]
        {
            new GatewayRecord
            {
                Id = "ssh",
                Url = "ws://127.0.0.1:18789",
                IsLocal = true,
                SetupManagedDistroName = "LuckyNemoGateway",
                SshTunnel = new SshTunnelConfig("user", "example.test", 18789, 18789),
            },
        };

        Assert.False(WslKeepAlivePolicy.HasSetupManagedLocalGateway(records));
    }

    [Fact]
    public void HasSetupManagedLocalGateway_ReturnsFalseForRemoteRecord()
    {
        var records = new[]
        {
            new GatewayRecord
            {
                Id = "remote",
                Url = "wss://gateway.example.test",
                SetupManagedDistroName = "LuckyNemoGateway",
            },
        };

        Assert.False(WslKeepAlivePolicy.HasSetupManagedLocalGateway(records));
    }

    [Fact]
    public void HasSetupManagedLocalGateway_ReturnsFalseForNullRecords()
    {
        Assert.False(WslKeepAlivePolicy.HasSetupManagedLocalGateway(null));
    }

    [Fact]
    public void FindStaleSetupManagedDistroNames_PreservesLegacyDefaultLocalDistro()
    {
        var records = new[]
        {
            new GatewayRecord
            {
                Id = "legacy-local",
                Url = "ws://localhost:18789",
                FriendlyName = "Local (LuckyNemoGateway)",
                IsLocal = true,
            },
        };

        var stale = WslKeepAlivePolicy.FindStaleSetupManagedDistroNames(
            records,
            ["LuckyNemoGateway"],
            setupStateDistroName: null);

        Assert.Empty(stale);
    }

    [Fact]
    public void FindStaleSetupManagedDistroNames_PreservesRegisteredLocalDistro_WhenRemoteIsActive()
    {
        var records = new[]
        {
            new GatewayRecord
            {
                Id = "local",
                Url = "ws://localhost:18789",
                IsLocal = true,
                SetupManagedDistroName = "LuckyNemoGateway",
            },
            new GatewayRecord
            {
                Id = "remote",
                Url = "wss://gateway.example.test",
                IsLocal = false,
            },
        };

        var stale = WslKeepAlivePolicy.FindStaleSetupManagedDistroNames(
            records,
            ["LuckyNemoGateway"],
            setupStateDistroName: "LuckyNemoGateway");

        Assert.Empty(stale);
    }

    [Fact]
    public void FindStaleSetupManagedDistroNames_ReturnsMarkerDistro_WhenNoLocalRecordOwnsIt()
    {
        var records = new[]
        {
            new GatewayRecord
            {
                Id = "remote",
                Url = "wss://gateway.example.test",
                IsLocal = false,
            },
        };

        var stale = WslKeepAlivePolicy.FindStaleSetupManagedDistroNames(
            records,
            ["OldLuckyNemoGateway"],
            setupStateDistroName: null);

        Assert.Equal(["OldLuckyNemoGateway"], stale);
    }

    [Fact]
    public void IsKeepaliveCommandLine_RequiresDistroAndSleepInfinity()
    {
        Assert.True(WslKeepAlivePolicy.IsKeepaliveCommandLine(
            @"C:\Windows\System32\wsl.exe -d LuckyNemoGateway -- sleep infinity",
            "LuckyNemoGateway"));
        Assert.False(WslKeepAlivePolicy.IsKeepaliveCommandLine(
            @"C:\Windows\System32\wsl.exe -d LuckyNemoGateway -- sleep 60",
            "LuckyNemoGateway"));
        Assert.False(WslKeepAlivePolicy.IsKeepaliveCommandLine(
            @"C:\Windows\System32\wsl.exe -d OtherGateway -- sleep infinity",
            "LuckyNemoGateway"));
        Assert.False(WslKeepAlivePolicy.IsKeepaliveCommandLine(
            @"C:\Windows\System32\wsl.exe -d LuckyNemoGateway-Dev -- sleep infinity",
            "LuckyNemoGateway"));
        Assert.True(WslKeepAlivePolicy.IsKeepaliveCommandLine(
            "wsl.exe --distribution \"LuckyNemoGateway-Dev\" -- sleep infinity",
            "LuckyNemoGateway-Dev"));
    }

    [Fact]
    public void TryGetMarkerDistroName_ReadsMarkerDistro()
    {
        Assert.True(WslKeepAlivePolicy.TryGetMarkerDistroName(
            """{"DistroName":"LuckyNemoGateway","Pid":123}""",
            out var distroName));

        Assert.Equal("LuckyNemoGateway", distroName);
    }
}
