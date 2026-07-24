using LuckyNemo.Connection;

namespace LuckyNemo.Tray.Tests;

public class GatewayTerminalLaunchCommandBuilderTests
{
    [Fact]
    public void Build_WslWithWindowsTerminal_UsesExplicitTerminalPathAndPositionalArguments()
    {
        var access = GatewayHostAccessClassifier.Classify(new GatewayRecord
        {
            Id = "local",
            Url = "ws://127.0.0.1:18789",
            SetupManagedDistroName = "LuckyNemoGateway",
        });

        var command = GatewayTerminalLaunchCommandBuilder.Build(access, @"C:\Users\me\AppData\Local\Microsoft\WindowsApps\wt.exe");

        Assert.Equal(@"C:\Users\me\AppData\Local\Microsoft\WindowsApps\wt.exe", command.FileName);
        Assert.True(command.UsesWindowsTerminal);
        Assert.Equal([
            "new-tab",
            "--title",
            "LuckyNemo Gateway (LuckyNemoGateway)",
            "wsl.exe",
            "-d",
            "LuckyNemoGateway"
        ], command.Arguments);
    }

    [Fact]
    public void Build_WslWithoutWindowsTerminal_FallsBackToWslExe()
    {
        var access = GatewayHostAccessClassifier.Classify(new GatewayRecord
        {
            Id = "local",
            Url = "ws://127.0.0.1:18789",
            SetupManagedDistroName = "LuckyNemoGateway",
        });

        var command = GatewayTerminalLaunchCommandBuilder.Build(access, windowsTerminalPath: null);

        Assert.Equal("wsl.exe", command.FileName);
        Assert.False(command.UsesWindowsTerminal);
        Assert.Equal(["-d", "LuckyNemoGateway"], command.Arguments);
    }

    [Fact]
    public void Build_SshTerminal_UsesUserAtHostWithoutTunnelForwardingArguments()
    {
        var access = GatewayHostAccessClassifier.Classify(new GatewayRecord
        {
            Id = "ssh",
            Url = "ws://127.0.0.1:18789",
            SshTunnel = new SshTunnelConfig("alice", "gateway.example.test", 18789, 18790),
        });

        var command = GatewayTerminalLaunchCommandBuilder.Build(access, windowsTerminalPath: null);

        Assert.Equal("ssh.exe", command.FileName);
        Assert.Equal(["alice@gateway.example.test"], command.Arguments);
        Assert.DoesNotContain("-N", command.Arguments);
        Assert.DoesNotContain("-L", command.Arguments);
        Assert.DoesNotContain("-p", command.Arguments);
    }

    [Fact]
    public void Build_RejectsRecordsWithoutTerminalAccess()
    {
        var access = GatewayHostAccessClassifier.Classify(new GatewayRecord
        {
            Id = "remote",
            Url = "wss://gateway.example.test",
        });

        Assert.Throws<InvalidOperationException>(() =>
            GatewayTerminalLaunchCommandBuilder.Build(access, windowsTerminalPath: null));
    }

    [Fact]
    public void BuildGatewayDoctor_WithWindowsTerminal_OpensThemedTabWithSemicolonFreeKeepOpen()
    {
        var access = GatewayHostAccessClassifier.Classify(new GatewayRecord
        {
            Id = "local",
            Url = "ws://127.0.0.1:18789",
            SetupManagedDistroName = "LuckyNemoGateway",
        });

        var command = GatewayTerminalLaunchCommandBuilder.BuildGatewayDoctor(
            access, @"C:\Users\me\AppData\Local\Microsoft\WindowsApps\wt.exe");

        // Keep-open must NOT contain ';': Windows Terminal splits its command line
        // on ';' even inside quotes. We use '|| true && exec bash' instead.
        var script = $"{WslGatewayControlCommandBuilder.LuckyNemoWslPathPrefix} && luckynemo doctor || true && exec bash";
        Assert.DoesNotContain(";", script);
        Assert.Equal(@"C:\Users\me\AppData\Local\Microsoft\WindowsApps\wt.exe", command.FileName);
        Assert.True(command.UsesWindowsTerminal);
        Assert.Equal([
            "new-tab",
            "--title",
            "LuckyNemo doctor (LuckyNemoGateway)",
            "wsl.exe",
            "-d",
            "LuckyNemoGateway",
            "--",
            "bash",
            "-lc",
            script
        ], command.Arguments);
    }

    [Fact]
    public void BuildGatewayDoctor_WithoutWindowsTerminal_FallsBackToWslExe()
    {
        var access = GatewayHostAccessClassifier.Classify(new GatewayRecord
        {
            Id = "local",
            Url = "ws://127.0.0.1:18789",
            SetupManagedDistroName = "LuckyNemoGateway",
        });

        var command = GatewayTerminalLaunchCommandBuilder.BuildGatewayDoctor(access, windowsTerminalPath: null);

        var script = $"{WslGatewayControlCommandBuilder.LuckyNemoWslPathPrefix} && luckynemo doctor || true && exec bash";
        Assert.Equal("wsl.exe", command.FileName);
        Assert.False(command.UsesWindowsTerminal);
        Assert.Equal(["-d", "LuckyNemoGateway", "--", "bash", "-lc", script], command.Arguments);
    }

    [Fact]
    public void BuildGatewayDoctor_RejectsSshGateway()
    {
        var access = GatewayHostAccessClassifier.Classify(new GatewayRecord
        {
            Id = "ssh",
            Url = "ws://127.0.0.1:18789",
            SshTunnel = new SshTunnelConfig("alice", "gateway.example.test", 18789, 18790),
        });

        Assert.Throws<InvalidOperationException>(() =>
            GatewayTerminalLaunchCommandBuilder.BuildGatewayDoctor(access, windowsTerminalPath: null));
    }
}
