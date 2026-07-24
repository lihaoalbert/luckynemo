using LuckyNemo.Shared;
using LuckyNemoTray.Services;

namespace LuckyNemo.Tray.Tests;

public class DeepLinkParserTests
{
    #region ParseDeepLink

    [Fact]
    public void ParseDeepLink_Settings()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://settings");
        Assert.NotNull(result);
        Assert.Equal("settings", result.Path);
        Assert.Empty(result.Query);
        Assert.Empty(result.Parameters);
    }

    [Fact]
    public void ParseDeepLink_Dashboard()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://dashboard");
        Assert.NotNull(result);
        Assert.Equal("dashboard", result.Path);
    }

    [Fact]
    public void ParseDeepLink_DashboardSubpath()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://dashboard/sessions");
        Assert.NotNull(result);
        Assert.Equal("dashboard/sessions", result.Path);
    }

    [Theory]
    [InlineData("luckynemo://dashboard/channels", "dashboard/channels")]
    [InlineData("luckynemo://dashboard/skills", "dashboard/skills")]
    [InlineData("luckynemo://dashboard/cron", "dashboard/cron")]
    public void ParseDeepLink_DashboardKnownSubpaths(string uri, string expectedPath)
    {
        var result = DeepLinkParser.ParseDeepLink(uri);
        Assert.NotNull(result);
        Assert.Equal(expectedPath, result.Path);
    }

    [Fact]
    public void ParseDeepLink_SendWithMessage()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://send?message=hello");
        Assert.NotNull(result);
        Assert.Equal("send", result.Path);
        Assert.Equal("hello", result.Parameters["message"]);
    }

    [Fact]
    public void ParseDeepLink_SendWithEncodedMessage()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://send?message=hello%20world");
        Assert.NotNull(result);
        Assert.Equal("hello world", result.Parameters["message"]);
    }

    [Fact]
    public void ParseDeepLink_MultipleQueryParams()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://agent?message=hi&key=abc");
        Assert.NotNull(result);
        Assert.Equal("agent", result.Path);
        Assert.Equal("hi", result.Parameters["message"]);
        Assert.Equal("abc", result.Parameters["key"]);
    }

    [Fact]
    public void ParseDeepLink_ActivityWithFilter()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://activity?filter=nodes");
        Assert.NotNull(result);
        Assert.Equal("activity", result.Path);
        Assert.Equal("nodes", result.Parameters["filter"]);
    }

    [Fact]
    public void ParseDeepLink_History()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://history");
        Assert.NotNull(result);
        Assert.Equal("history", result.Path);
    }

    [Theory]
    [InlineData("luckynemo://setup", "setup")]
    [InlineData("luckynemo://healthcheck", "healthcheck")]
    [InlineData("luckynemo://check-updates", "check-updates")]
    [InlineData("luckynemo://logs", "logs")]
    [InlineData("luckynemo://log-folder", "log-folder")]
    [InlineData("luckynemo://config", "config")]
    [InlineData("luckynemo://diagnostics", "diagnostics")]
    [InlineData("luckynemo://support-context", "support-context")]
    [InlineData("luckynemo://debug-bundle", "debug-bundle")]
    [InlineData("luckynemo://browser-setup", "browser-setup")]
    [InlineData("luckynemo://port-diagnostics", "port-diagnostics")]
    [InlineData("luckynemo://capability-diagnostics", "capability-diagnostics")]
    [InlineData("luckynemo://node-inventory", "node-inventory")]
    [InlineData("luckynemo://channel-summary", "channel-summary")]
    [InlineData("luckynemo://activity-summary", "activity-summary")]
    [InlineData("luckynemo://extensibility-summary", "extensibility-summary")]
    [InlineData("luckynemo://restart-ssh-tunnel", "restart-ssh-tunnel")]
    public void ParseDeepLink_TrayUtilityEntrypoints(string uri, string expectedPath)
    {
        var result = DeepLinkParser.ParseDeepLink(uri);
        Assert.NotNull(result);
        Assert.Equal(expectedPath, result.Path);
    }

    [Fact]
    public void ParseDeepLink_TrailingSlash_IsStripped()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://settings/");
        Assert.NotNull(result);
        Assert.Equal("settings", result.Path);
    }

    [Theory]
    [InlineData("luckynemo://send/?message=hello", "send")]
    [InlineData("luckynemo://agent/?message=hi&key=abc", "agent")]
    [InlineData("luckynemo://activity/?filter=nodes", "activity")]
    public void ParseDeepLink_TrailingSlashBeforeQuery_IsStripped(string uri, string expectedPath)
    {
        // Windows canonicalizes luckynemo://send?... to luckynemo://send/?...
        // before handing it to us. The slash sits before the `?`, so a naïve
        // TrimEnd before query split fails to strip it. Regression test for
        // the off-by-one fix in DeepLinkParser.ParseDeepLink.
        var result = DeepLinkParser.ParseDeepLink(uri);
        Assert.NotNull(result);
        Assert.Equal(expectedPath, result!.Path);
    }

    [Fact]
    public void ParseDeepLink_CaseInsensitiveScheme()
    {
        var result = DeepLinkParser.ParseDeepLink("LUCKYNEMO://dashboard");
        Assert.NotNull(result);
        Assert.Equal("dashboard", result.Path);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ParseDeepLink_NullOrEmpty_ReturnsNull(string? uri)
    {
        Assert.Null(DeepLinkParser.ParseDeepLink(uri));
    }

    [Fact]
    public void ParseDeepLink_NoProtocol_ReturnsNull()
    {
        Assert.Null(DeepLinkParser.ParseDeepLink("settings"));
    }

    [Fact]
    public void ParseDeepLink_WrongProtocol_ReturnsNull()
    {
        Assert.Null(DeepLinkParser.ParseDeepLink("https://settings"));
    }

    [Fact]
    public void ParseDeepLink_EmptyPath()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://");
        Assert.NotNull(result);
        Assert.Equal("", result.Path);
    }

    [Fact]
    public void ParseDeepLink_MalformedQuery_IgnoresKeyOnly()
    {
        var result = DeepLinkParser.ParseDeepLink("luckynemo://send?message");
        Assert.NotNull(result);
        Assert.Empty(result.Parameters);
    }

    #endregion

    #region GetQueryParam

    [Fact]
    public void GetQueryParam_ExtractsValue()
    {
        Assert.Equal("hello", DeepLinkParser.GetQueryParam("message=hello", "message"));
    }

    [Fact]
    public void GetQueryParam_CaseInsensitiveKey()
    {
        Assert.Equal("hello", DeepLinkParser.GetQueryParam("MESSAGE=hello", "message"));
    }

    [Fact]
    public void GetQueryParam_UrlDecodes()
    {
        Assert.Equal("hello world", DeepLinkParser.GetQueryParam("msg=hello%20world", "msg"));
    }

    [Fact]
    public void GetQueryParam_MissingKey_ReturnsNull()
    {
        Assert.Null(DeepLinkParser.GetQueryParam("message=hello", "missing"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void GetQueryParam_NullOrEmptyQuery_ReturnsNull(string? query)
    {
        Assert.Null(DeepLinkParser.GetQueryParam(query, "key"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void GetQueryParam_NullOrEmptyKey_ReturnsNull(string? key)
    {
        Assert.Null(DeepLinkParser.GetQueryParam("message=hello", key!));
    }

    [Fact]
    public void GetQueryParam_MultipleParams_FindsCorrect()
    {
        Assert.Equal("bar", DeepLinkParser.GetQueryParam("foo=baz&key=bar&x=1", "key"));
    }

    [Fact]
    public void GetQueryParam_ValueWithEquals()
    {
        Assert.Equal("a=b", DeepLinkParser.GetQueryParam("token=a=b", "token"));
    }

    #endregion

    #region DeepLinkHandler

    [Theory]
    [InlineData("luckynemo://settings", nameof(DeepLinkActions.OpenHub))]
    [InlineData("luckynemo://setup", nameof(DeepLinkActions.OpenSetup))]
    [InlineData("luckynemo://chat", nameof(DeepLinkActions.OpenHub))]
    [InlineData("luckynemo://commandcenter", nameof(DeepLinkActions.OpenHub))]
    [InlineData("luckynemo://history", nameof(DeepLinkActions.OpenHub))]
    [InlineData("luckynemo://logs", nameof(DeepLinkActions.OpenLogFile))]
    [InlineData("luckynemo://log-folder", nameof(DeepLinkActions.OpenLogFolder))]
    [InlineData("luckynemo://config", nameof(DeepLinkActions.OpenConfigFolder))]
    [InlineData("luckynemo://diagnostics", nameof(DeepLinkActions.OpenDiagnosticsFolder))]
    [InlineData("luckynemo://support-context", nameof(DeepLinkActions.CopySupportContext))]
    [InlineData("luckynemo://debug-bundle", nameof(DeepLinkActions.CopyDebugBundle))]
    [InlineData("luckynemo://browser-setup", nameof(DeepLinkActions.CopyBrowserSetupGuidance))]
    [InlineData("luckynemo://port-diagnostics", nameof(DeepLinkActions.CopyPortDiagnostics))]
    [InlineData("luckynemo://capability-diagnostics", nameof(DeepLinkActions.CopyCapabilityDiagnostics))]
    [InlineData("luckynemo://node-inventory", nameof(DeepLinkActions.CopyNodeInventory))]
    [InlineData("luckynemo://channel-summary", nameof(DeepLinkActions.CopyChannelSummary))]
    [InlineData("luckynemo://activity-summary", nameof(DeepLinkActions.CopyActivitySummary))]
    [InlineData("luckynemo://extensibility-summary", nameof(DeepLinkActions.CopyExtensibilitySummary))]
    [InlineData("luckynemo://check-updates", nameof(DeepLinkActions.CheckForUpdates))]
    [InlineData("luckynemo://restart-ssh-tunnel", nameof(DeepLinkActions.RestartSshTunnel))]
    public void Handle_InvokesExpectedAction(string uri, string expectedAction)
    {
        var invoked = "";
        var actions = new DeepLinkActions
        {
            OpenHub = _ => invoked = nameof(DeepLinkActions.OpenHub),
            OpenSetup = () => invoked = nameof(DeepLinkActions.OpenSetup),
            OpenLogFile = () => invoked = nameof(DeepLinkActions.OpenLogFile),
            OpenLogFolder = () => invoked = nameof(DeepLinkActions.OpenLogFolder),
            OpenConfigFolder = () => invoked = nameof(DeepLinkActions.OpenConfigFolder),
            OpenDiagnosticsFolder = () => invoked = nameof(DeepLinkActions.OpenDiagnosticsFolder),
            CopySupportContext = () => invoked = nameof(DeepLinkActions.CopySupportContext),
            CopyDebugBundle = () => invoked = nameof(DeepLinkActions.CopyDebugBundle),
            CopyBrowserSetupGuidance = () => invoked = nameof(DeepLinkActions.CopyBrowserSetupGuidance),
            CopyPortDiagnostics = () => invoked = nameof(DeepLinkActions.CopyPortDiagnostics),
            CopyCapabilityDiagnostics = () => invoked = nameof(DeepLinkActions.CopyCapabilityDiagnostics),
            CopyNodeInventory = () => invoked = nameof(DeepLinkActions.CopyNodeInventory),
            CopyChannelSummary = () => invoked = nameof(DeepLinkActions.CopyChannelSummary),
            CopyActivitySummary = () => invoked = nameof(DeepLinkActions.CopyActivitySummary),
            CopyExtensibilitySummary = () => invoked = nameof(DeepLinkActions.CopyExtensibilitySummary),
            OpenActivityStream = _ => invoked = nameof(DeepLinkActions.OpenActivityStream),
            CheckForUpdates = () =>
            {
                invoked = nameof(DeepLinkActions.CheckForUpdates);
                return Task.CompletedTask;
            },
            RestartSshTunnel = () => invoked = nameof(DeepLinkActions.RestartSshTunnel)
        };

        DeepLinkHandler.Handle(uri, actions);

        Assert.Equal(expectedAction, invoked);
    }

    [Theory]
    [InlineData("luckynemo://activity", "channels")]
    [InlineData("luckynemo://activity?filter=usage", "usage")]
    [InlineData("luckynemo://activity?filter=session", "sessions")]
    [InlineData("luckynemo://activity?filter=node", "instances")]
    [InlineData("luckynemo://history", "channels")]
    [InlineData("luckynemo://notification-history", "channels")]
    [InlineData("luckynemo://commandcenter", "connection")]
    [InlineData("luckynemo://command-center", "connection")]
    public void Handle_HubRouteAliases_OpenExpectedHubTag(string uri, string expectedHubTag)
    {
        string? hubTag = null;
        var actions = new DeepLinkActions
        {
            OpenHub = tag => hubTag = tag
        };

        DeepLinkHandler.Handle(uri, actions);

        Assert.Equal(expectedHubTag, hubTag);
    }

    [Fact]
    public void Handle_DashboardSubpath_PassesPath()
    {
        string? dashboardPath = null;
        var actions = new DeepLinkActions
        {
            OpenDashboard = path => dashboardPath = path
        };

        DeepLinkHandler.Handle("luckynemo://dashboard/skills", actions);

        Assert.Equal("skills", dashboardPath);
    }

    [Fact]
    public void Handle_Activity_RedirectsToChannelsByDefault()
    {
        // ActivityPage was removed; luckynemo://activity now routes to the
        // appropriate hub page based on the filter parameter. With no filter
        // (or notification/channel), Channels is the destination.
        string? hubTag = null;
        var actions = new DeepLinkActions
        {
            OpenHub = tag => hubTag = tag
        };

        DeepLinkHandler.Handle("luckynemo://activity?filter=node", actions);
        Assert.Equal("instances", hubTag);

        hubTag = null;
        DeepLinkHandler.Handle("luckynemo://activity?filter=session", actions);
        Assert.Equal("sessions", hubTag);

        hubTag = null;
        DeepLinkHandler.Handle("luckynemo://activity", actions);
        Assert.Equal("channels", hubTag);
    }

    [Fact]
    public async Task Handle_Agent_SendsMessage()
    {
        var sent = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var actions = new DeepLinkActions
        {
            SendMessage = message =>
            {
                sent.SetResult(message);
                return Task.CompletedTask;
            }
        };

        DeepLinkHandler.Handle("luckynemo://agent?message=ping", actions);

        Assert.Equal("ping", await sent.Task.WaitAsync(TimeSpan.FromSeconds(3)));
    }

    [Fact]
    public async Task Handle_HealthCheck_RunsAction()
    {
        var ran = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var actions = new DeepLinkActions
        {
            RunHealthCheck = () =>
            {
                ran.SetResult(true);
                return Task.CompletedTask;
            }
        };

        DeepLinkHandler.Handle("luckynemo://healthcheck", actions);

        Assert.True(await ran.Task.WaitAsync(TimeSpan.FromSeconds(3)));
    }

    #endregion
}
