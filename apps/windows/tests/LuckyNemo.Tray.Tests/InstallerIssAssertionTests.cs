namespace LuckyNemo.Tray.Tests;

/// <summary>
/// Structural assertions on installer.iss.  These pin contracts that cannot
/// be exercised by an in-process unit test because they require ISCC + the
/// resulting unins000.exe to verify end-to-end.
///
/// Round 2 (Scott #5) — AppMutex coordination prevents the Inno uninstaller
/// from racing the running tray on shared state (settings.json,
/// gateways.json, device-key-ed25519.json, Logs/).  The mutex name must
/// match App.xaml.cs's single-instance mutex.
/// </summary>
public sealed class InstallerIssAssertionTests
{
    [Fact]
    public void Installer_HasAppMutexMatchingTraySingleInstance()
    {
        var iss = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), "installer.iss"));
        // Release build uses "LuckyNemoTray" mutex; dev build uses "LuckyNemoTray-Dev".
        // The installer default (non-DevBuild) must match the release mutex.
        Assert.Contains("AppMutex={#MyMutex}", iss);
        Assert.Contains(@"#define MyMutex ""LuckyNemoTray""", iss);
        Assert.Contains("Inno requires \"{{\" to emit a literal opening brace in AppId.", iss);
        // LuckyNemo fork uses a fresh upgrade-path GUID (upstream used a M0LTB0T pseudo-GUID).
        Assert.Contains(@"#define MyAppId ""{{A793B368-B0E0-4BDB-AA01-716E442A117E}""", iss);

        // The matching tray-side mutex name must be present in App.xaml.cs via AppIdentity.
        var appXamlCs = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(), "src", "LuckyNemo.Tray.WinUI", "App.xaml.cs"));
        Assert.Contains("var mutexName = AppIdentity.MutexBaseName;", appXamlCs);
    }

    [Fact]
    public void Installer_DoesNotShipCommandPaletteExtension()
    {
        var iss = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), "installer.iss"));

        Assert.DoesNotContain("cmdpalette", iss, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("CommandPalette", iss, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Add-AppxPackage", iss, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Remove-AppxPackage", iss, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Installer_CreatesStartMenuEntrypointsForTraySetupAndSupport()
    {
        var iss = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), "installer.iss"));

        Assert.Contains(@"#define MyAppName ""LuckyNemo Companion""", iss);
        Assert.Contains(@"#define MyAppAumid ""LuckyNemo.Companion""", iss);
        Assert.Contains(@"#define MyCompression ""lzma""", iss);
        Assert.Contains(@"#define MySolidCompression ""yes""", iss);
        Assert.Contains("OutputBaseFilename=LuckyNemoCompanion{#MyOutputSuffix}-Setup-{#MyAppArch}", iss);
        foreach (var iconEntry in new[]
        {
            @"Name: ""{group}\{#MyAppName}""; Filename: ""{app}\{#MyAppExeName}""; AppUserModelID: ""{#MyAppAumid}""",
            @"Name: ""{group}\LuckyNemo Gateway Setup""; Filename: ""{app}\{#MyAppExeName}""; Parameters: ""{#MyProtocol}://setup""; IconFilename: ""{app}\{#MyAppExeName}""; AppUserModelID: ""{#MyAppAumid}""",
            @"Name: ""{group}\LuckyNemo Companion Settings""; Filename: ""{app}\{#MyAppExeName}""; Parameters: ""{#MyProtocol}://commandcenter""; IconFilename: ""{app}\{#MyAppExeName}""; AppUserModelID: ""{#MyAppAumid}""",
            @"Name: ""{group}\LuckyNemo Chat""; Filename: ""{app}\{#MyAppExeName}""; Parameters: ""{#MyProtocol}://chat""; IconFilename: ""{app}\{#MyAppExeName}""; AppUserModelID: ""{#MyAppAumid}""",
            @"Name: ""{group}\Check for Updates""; Filename: ""{app}\{#MyAppExeName}""; Parameters: ""{#MyProtocol}://check-updates""; IconFilename: ""{app}\{#MyAppExeName}""; AppUserModelID: ""{#MyAppAumid}""",
            @"Name: ""{autodesktop}\{#MyAppName}""; Filename: ""{app}\{#MyAppExeName}""; Tasks: desktopicon; AppUserModelID: ""{#MyAppAumid}""",
            @"Name: ""{userstartup}\{#MyAppName}""; Filename: ""{app}\{#MyAppExeName}""; Tasks: startupicon; AppUserModelID: ""{#MyAppAumid}"""
        })
        {
            Assert.Contains(iconEntry, iss);
        }
        Assert.DoesNotContain("AppUserModelID: \"LuckyNemo.Tray.WinUI\"", iss);
    }

    [Fact]
    public void Installer_RemovesGeneratedAppStateOnlyAfterGatewayCleanup()
    {
        var iss = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), "installer.iss"));

        Assert.DoesNotContain("[UninstallRun]", iss);
        Assert.Contains("[Code]", iss);
        Assert.Contains("Uninstall-LocalGateway.ps1", iss);
        Assert.Contains("UninstallSilent()", iss);
        Assert.Contains("LocalGatewayCleanupRequested := True", iss);
        Assert.Contains("{#MyDistroName} WSL distro", iss);
        Assert.Contains("MB_YESNO", iss);
        Assert.Contains("ExpandConstant('{sys}\\WindowsPowerShell\\v1.0\\powershell.exe')", iss);
        Assert.Contains("ewWaitUntilTerminated", iss);
        Assert.Contains("MB_RETRYCANCEL", iss);
        Assert.Contains("DeleteGeneratedAppState", iss);
        Assert.Contains("procedure RemoveAppAutoStart;", iss);
        Assert.Matches(@"    RemoveAppAutoStart;\r?\n    EnsureLocalGatewayCleanupChoice;", iss);
        Assert.Contains("CurUninstallStep = usPostUninstall", iss);
        Assert.Contains("DelTree(ExpandConstant('{app}'), True, True, True)", iss);
        Assert.DoesNotContain("Start-Sleep -Seconds 3", iss);
        Assert.DoesNotContain("--uninstall --confirm-destructive", iss);
        Assert.DoesNotContain("[UninstallDelete]", iss);
    }

    [Fact]
    public void UninstallLocalGatewayScript_DirectlyUnregistersWslDistro()
    {
        var script = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), "scripts", "Uninstall-LocalGateway.ps1"));

        Assert.Contains("$DistroName = 'LuckyNemoGateway'", script);
        Assert.Contains("'--list', '--quiet'", script);
        Assert.Contains("'--terminate', $DistroName", script);
        Assert.DoesNotContain("'--shutdown'", script);
        Assert.Contains("'--unregister', $DistroName", script);
        Assert.Contains("Start-Sleep -Seconds 2", script);
        Assert.Contains("Remove-GatewayDirectory", script);
        Assert.Contains("Remove-WindowsGatewayArtifacts", script);
        Assert.Contains("gateways.json", script);
        Assert.Contains("device-key-ed25519.json", script);
        Assert.Contains("LuckyNemoTray", script);
        Assert.Contains("setup-state.json", script);
        Assert.Contains("wsl-keepalive", script);
        Assert.Contains("Test-DistroListed", script);
        Assert.Contains("Test-DistroNotFound", script);
        Assert.Contains("FileAttributes]::ReparsePoint", script);
        Assert.Contains("Refusing to recursively delete reparse point", script);
        Assert.Contains("for ($attempt = 1; $attempt -le 6; $attempt++)", script);
        Assert.Contains("exit $unregisterResult.ExitCode", script);
        Assert.DoesNotContain("LuckyNemo.Tray.WinUI.exe", script);
        Assert.DoesNotContain("LuckyNemo.SetupEngine.UI.exe", script);
        Assert.DoesNotContain("--headless", script);
        Assert.DoesNotContain("--confirm-destructive", script);
    }

    [Fact]
    public void Installer_RegistersLuckyNemoProtocol()
    {
        var iss = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), "installer.iss"));

        // Protocol registration uses preprocessor variable {#MyProtocol}
        Assert.Contains(@"Subkey: ""Software\Classes\{#MyProtocol}""", iss);
        Assert.Contains(@"ValueName: ""URL Protocol""", iss);
        Assert.Contains(@"Subkey: ""Software\Classes\{#MyProtocol}\shell\open\command""", iss);
        Assert.Contains(@"{app}\{#MyAppExeName}", iss);
        Assert.Contains(@"""%1""", iss);
        // Ensure release default protocol is "luckynemo"
        Assert.Contains(@"#define MyProtocol ""luckynemo""", iss);
    }

    [Fact]
    public void DevInstaller_UsesIndependentIdentityAndProtocol()
    {
        var iss = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), "installer.iss"));

        Assert.Contains(@"#define MyAppName ""LuckyNemo Companion (Dev)""", iss);
        Assert.Contains(@"#define MyAppAumid ""LuckyNemo.Companion.Dev""", iss);
        Assert.Contains(@"#define MyInstallDir ""LuckyNemoTray-Dev""", iss);
        Assert.Contains(@"#define MyMutex ""LuckyNemoTray-Dev""", iss);
        Assert.Contains(@"#define MyProtocol ""luckynemo-dev""", iss);
        Assert.Contains(@"#define MyDistroName ""LuckyNemoGateway-Dev""", iss);
        Assert.Contains(@"#define MyAppPublisher ""LuckyNemo""", iss);
        Assert.Contains("-DataDirectoryName ' + AddQuotes('{#MyInstallDir}')", iss);
        Assert.Contains("-AutoStartName ' + AddQuotes('{#MyAutoStartName}')", iss);
        Assert.Contains("-StartupTaskName ' + AddQuotes('{#MyStartupTaskName}')", iss);
        Assert.Contains("-DistroName ' + AddQuotes('{#MyDistroName}')", iss);

        var uninstallScript = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(), "scripts", "Uninstall-LocalGateway.ps1"));
        Assert.Contains("[string]$DataDirectoryName = 'LuckyNemoTray'", uninstallScript);
        Assert.Contains("-Name $AutoStartName", uninstallScript);
        Assert.Contains("/TN $StartupTaskName", uninstallScript);

        var autoStartManager = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(), "src", "LuckyNemo.Tray.WinUI", "Services", "AutoStartManager.cs"));
        Assert.Contains("AppIdentity.StartupTaskName", autoStartManager);
    }

    [Fact]
    public void LocalInstallerBuild_UsesOneIdentitySwitchAndValidatesPayloadMarker()
    {
        var root = TestRepositoryPaths.GetRepositoryRoot();
        var script = File.ReadAllText(Path.Combine(root, "scripts", "build-inno-local.ps1"));
        var runScript = File.ReadAllText(Path.Combine(root, "run-app-local.ps1"));
        var buildScript = File.ReadAllText(Path.Combine(root, "build.ps1"));
        var project = File.ReadAllText(Path.Combine(
            root, "src", "LuckyNemo.Tray.WinUI", "LuckyNemo.Tray.WinUI.csproj"));

        Assert.Contains("[switch]$Dev", script);
        Assert.Contains("-p:DevBuild=$($Dev.IsPresent.ToString().ToLowerInvariant())", script);
        Assert.Contains("$args += \"/DDevBuild=1\"", script);
        Assert.Contains("app-identity.txt", script);
        Assert.Contains("Payload identity", script);
        Assert.Contains("2>&1 | Out-Host", script);
        Assert.Contains("$wingetExitCode = $LASTEXITCODE", script);
        Assert.Contains("[switch]$Dev,", runScript);
        Assert.Contains("$buildArgs = @{", runScript);
        Assert.Contains("Configuration = $Configuration", runScript);
        Assert.Contains("$buildArgs[\"DevBuild\"] = $true", runScript);
        Assert.Contains("app-identity.txt", runScript);
        Assert.Contains("does not match requested", runScript);
        Assert.Contains("[switch]$DevBuild,", buildScript);
        Assert.Contains("$dotnetArgs += \"-p:DevBuild=true\"", buildScript);
        Assert.Contains("-UseWinApp$runIdentitySwitch", buildScript);
        Assert.Contains("WritePublishedAppIdentityMarker", project);
        Assert.Contains("WriteBuildAppIdentityMarker", project);
        Assert.Contains("<AppIdentityMarker>dev</AppIdentityMarker>", project);
        Assert.Contains("<AppIdentityMarker>release</AppIdentityMarker>", project);
        Assert.DoesNotContain("'$(Configuration)' == 'Debug'", project);
        Assert.DoesNotContain("<DevBuild>true</DevBuild>", project);
    }

    [Fact]
    public void MsixManifest_IsGeneratedUnderObjWithoutMutatingTrackedSource()
    {
        var root = TestRepositoryPaths.GetRepositoryRoot();
        var project = File.ReadAllText(Path.Combine(
            root, "src", "LuckyNemo.Tray.WinUI", "LuckyNemo.Tray.WinUI.csproj"));
        var manifest = File.ReadAllText(Path.Combine(
            root, "src", "LuckyNemo.Tray.WinUI", "Package.appxmanifest"));

        Assert.Contains("GenerateLuckyNemoAppxManifest", project);
        Assert.Contains("$(IntermediateOutputPath)luckynemo.Package.appxmanifest", project);
        Assert.Contains(@"<AppxManifest Remove=""@(AppxManifest)"" />", project);
        Assert.DoesNotContain("PatchDevAppxManifestIdentity", project);
        Assert.Contains("Version=\"0.0.0.0\"", manifest);
        Assert.Contains("Name=\"LuckyNemo.Companion\"", manifest);
        Assert.Contains("<uap:Protocol Name=\"luckynemo\">", manifest);
        Assert.DoesNotContain("LuckyNemo.Companion.Dev", manifest);
    }

    [Fact]
    public void ReleaseBuildDoesNotShipSeparateSetupUiExecutable()
    {
        var iss = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), "installer.iss"));
        var ci = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), ".github", "workflows", "ci.yml"));

        Assert.Contains(@"FileExists(publish + ""\LuckyNemo.Tray.WinUI.exe"")", iss);
        Assert.Contains(@"FileExists(publish + ""\SetupEngine\LuckyNemo.SetupEngine.UI.exe"")", iss);
        Assert.Contains("SetupEngine.UI.exe should not be shipped", iss);
        Assert.DoesNotContain("Publish SetupEngine.UI", ci);
        Assert.DoesNotContain(@"dotnet publish src/LuckyNemo.SetupEngine.UI", ci);
        Assert.DoesNotContain("publish-setup", ci);
        Assert.DoesNotContain(@"mkdir publish\SetupEngine", ci);
        Assert.DoesNotContain(@"copy publish-setup\* publish\SetupEngine\ -Recurse", ci);
    }

    [Fact]
    public void MxcSdk_IsRestoredCopiedValidatedAndIncludedInInstallerPayload()
    {
        var repositoryRoot = TestRepositoryPaths.GetRepositoryRoot();
        var packageJson = File.ReadAllText(Path.Combine(repositoryRoot, "package.json"));
        var packageLock = File.ReadAllText(Path.Combine(repositoryRoot, "package-lock.json"));
        var trayProject = File.ReadAllText(Path.Combine(
            repositoryRoot, "src", "LuckyNemo.Tray.WinUI", "LuckyNemo.Tray.WinUI.csproj"));
        var iss = File.ReadAllText(Path.Combine(repositoryRoot, "installer.iss"));

        Assert.Contains(@"""@microsoft/mxc-sdk""", packageJson);
        Assert.Contains(@"""@microsoft/mxc-sdk"": ""^0.7.0""", packageJson);
        Assert.Contains(@"""node_modules/@microsoft/mxc-sdk""", packageLock);
        Assert.Contains(@"""version"": ""0.7.0""", packageLock);
        Assert.Contains("RestoreMxcNodeBridge", trayProject);
        Assert.Contains(@"Inputs=""$(LuckyNemoRepoRoot)package-lock.json""", trayProject);
        Assert.Contains(@"<MxcSdkRestoreStamp>$(LuckyNemoRepoRoot)node_modules\.luckynemo-mxc-sdk-$(MxcSdkExpectedVersion).stamp</MxcSdkRestoreStamp>", trayProject);
        Assert.Contains(@"Outputs=""$(MxcSdkRestoreStamp)""", trayProject);
        Assert.Contains(@"<Touch Files=""$(MxcSdkRestoreStamp)"" AlwaysCreate=""true"" />", trayProject);
        Assert.Contains("npm ci --no-audit --no-fund", trayProject);
        Assert.Contains("CopyWxcExecToOutput", trayProject);
        Assert.Contains("CopyWxcExecToPublish", trayProject);
        Assert.Contains("ValidateWxcExecShipped", trayProject);
        Assert.Contains("ValidateWxcExecPublished", trayProject);
        Assert.Contains(@"tools\mxc\$(MxcArch)\wxc-exec.exe", trayProject);

        // The Inno payload recurses through the prepared publish directory, so
        // publish-time tools\mxc\<arch>\wxc-exec.exe is shipped with the app.
        Assert.Contains(@"Source: ""{#publish}\*""; DestDir: ""{app}""; Flags: ignoreversion recursesubdirs", iss);
    }

    [Fact]
    public void MxcRuntime_ProbesShippedWxcExecAndSystemRunUsesIt()
    {
        var repositoryRoot = TestRepositoryPaths.GetRepositoryRoot();
        var availability = File.ReadAllText(Path.Combine(
            repositoryRoot, "src", "LuckyNemo.Shared", "Mxc", "MxcAvailability.cs"));
        var nodeService = File.ReadAllText(Path.Combine(
            repositoryRoot, "src", "LuckyNemo.Tray.WinUI", "Services", "NodeService.cs"));

        Assert.Contains(@"Path.Combine(root, ""tools"", ""mxc"", arch, ""wxc-exec.exe"")", availability);
        Assert.Contains("WxcExecOverrideEnvVar", availability);
        Assert.Contains("node_modules", availability);
        Assert.Contains("@microsoft", availability);
        Assert.Contains("mxc-sdk", availability);

        Assert.Contains("private ICommandRunner BuildSystemRunRunner()", nodeService);
        Assert.Contains("MxcAvailability.Probe(_logger)", nodeService);
        Assert.Contains("new DirectAppContainerExecutor(GetOrProbeMxcAvailability, _logger)", nodeService);
        Assert.Contains("return new MxcCommandRunner(", nodeService);
    }

}
