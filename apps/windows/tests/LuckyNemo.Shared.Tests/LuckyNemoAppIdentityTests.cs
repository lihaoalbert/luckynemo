using LuckyNemo.Shared;

namespace LuckyNemo.Shared.Tests;

public sealed class LuckyNemoAppIdentityTests
{
    [Fact]
    public void ResolveRoamingDataDirectory_DefaultsToReleaseProfile()
    {
        var root = Path.Combine(Path.GetTempPath(), "luckynemo-appdata");
        var path = LuckyNemoAppIdentity.ResolveRoamingDataDirectory(
            key => key == LuckyNemoAppIdentity.AppDataRootEnvironmentVariable ? root : null);

        Assert.Equal(Path.Combine(root, "LuckyNemoTray"), path);
    }

    [Fact]
    public void ResolveRoamingDataDirectory_UsesDevProfileFromEnvironment()
    {
        var root = Path.Combine(Path.GetTempPath(), "luckynemo-appdata");
        var path = LuckyNemoAppIdentity.ResolveRoamingDataDirectory(
            key => key switch
            {
                LuckyNemoAppIdentity.AppDataRootEnvironmentVariable => root,
                LuckyNemoAppIdentity.IdentityEnvironmentVariable => LuckyNemoAppIdentity.DevIdentity,
                _ => null
            });

        Assert.Equal(Path.Combine(root, "LuckyNemoTray-Dev"), path);
    }

    [Fact]
    public void ResolveRoamingDataDirectory_ExplicitIdentityWinsOverEnvironment()
    {
        var root = Path.Combine(Path.GetTempPath(), "luckynemo-appdata");
        var path = LuckyNemoAppIdentity.ResolveRoamingDataDirectory(
            key => key switch
            {
                LuckyNemoAppIdentity.AppDataRootEnvironmentVariable => root,
                LuckyNemoAppIdentity.IdentityEnvironmentVariable => LuckyNemoAppIdentity.DevIdentity,
                _ => null
            },
            explicitIdentity: LuckyNemoAppIdentity.ReleaseIdentity);

        Assert.Equal(Path.Combine(root, "LuckyNemoTray"), path);
    }

    [Fact]
    public void ResolveRoamingDataDirectory_DataDirOverrideWinsOverIdentity()
    {
        var direct = Path.Combine(Path.GetTempPath(), "luckynemo-direct-data");
        var path = LuckyNemoAppIdentity.ResolveRoamingDataDirectory(
            key => key switch
            {
                LuckyNemoAppIdentity.DataDirectoryOverrideEnvironmentVariable => direct,
                LuckyNemoAppIdentity.IdentityEnvironmentVariable => LuckyNemoAppIdentity.DevIdentity,
                _ => null
            });

        Assert.Equal(direct, path);
    }

    [Fact]
    public void ResolveSettingsAndTokenPaths_UseSelectedProfile()
    {
        var root = Path.Combine(Path.GetTempPath(), "luckynemo-appdata");
        Func<string, string?> env = key =>
            key == LuckyNemoAppIdentity.AppDataRootEnvironmentVariable ? root : null;

        Assert.Equal(
            Path.Combine(root, "LuckyNemoTray-Dev", "settings.json"),
            LuckyNemoAppIdentity.ResolveSettingsPath(env, LuckyNemoAppIdentity.DevIdentity));
        Assert.Equal(
            Path.Combine(root, "LuckyNemoTray-Dev", "mcp-token.txt"),
            LuckyNemoAppIdentity.ResolveMcpTokenPath(env, LuckyNemoAppIdentity.DevIdentity));
    }

    [Fact]
    public void NormalizeIdentity_RejectsUnknownIdentity()
    {
        var ex = Assert.Throws<ArgumentException>(() => LuckyNemoAppIdentity.NormalizeIdentity("staging"));

        Assert.Contains("release", ex.Message);
        Assert.Contains("dev", ex.Message);
    }
}
