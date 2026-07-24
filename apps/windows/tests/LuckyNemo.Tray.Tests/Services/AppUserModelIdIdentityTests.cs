using System.IO;
using LuckyNemoTray;
using Xunit;

namespace LuckyNemo.Tray.Tests.Services;

public sealed class AppUserModelIdIdentityTests
{
    [Fact]
    public void WinUiProject_UsesHumanReadableMetadataForNotificationSenderFallback()
    {
        var project = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(),
            "src",
            "LuckyNemo.Tray.WinUI",
            "LuckyNemo.Tray.WinUI.csproj"));

        Assert.Contains("<AssemblyTitle>LuckyNemo Companion</AssemblyTitle>", project);
        Assert.Contains("<FileDescription>LuckyNemo Companion</FileDescription>", project);
        Assert.Contains("<Product>LuckyNemo Companion</Product>", project);
        Assert.Contains("<AssemblyTitle>LuckyNemo Companion (Dev)</AssemblyTitle>", project);
        Assert.Contains("<FileDescription>LuckyNemo Companion (Dev)</FileDescription>", project);
        Assert.Contains("<Product>LuckyNemo Companion (Dev)</Product>", project);
        Assert.DoesNotContain("<AssemblyTitle>LuckyNemo.Tray.WinUI</AssemblyTitle>", project);
    }

    [Fact]
    public void Registrar_SkipsExplicitAumidWhenMsixPackageIdentityExists()
    {
        var source = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(),
            "src",
            "LuckyNemo.Tray.WinUI",
            "Services",
            "AppUserModelIdRegistrar.cs"));

        Assert.Contains("GetCurrentPackageFullName", source);
        Assert.Contains("AppModelErrorNoPackage", source);
        Assert.Contains("HResult", source);
        Assert.Contains("SetCurrentProcessExplicitAppUserModelID", source);
    }

    [Fact]
    public void AppUserModelId_UsesCompanionIdentity()
    {
        Assert.Equal(AppIdentity.PackageIdentityName, AppIdentity.AppUserModelId);
        Assert.DoesNotContain("LuckyNemo.Tray.WinUI", AppIdentity.AppUserModelId);
    }

    [Fact]
    public void InstallerAumid_MatchesRuntimeAppUserModelId()
    {
        var iss = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(),
            "installer.iss"));

        Assert.Contains($@"#define MyAppAumid ""{AppIdentity.AppUserModelId}""", iss);
        Assert.Contains(@"#define MyAppAumid ""LuckyNemo.Companion.Dev""", iss);
    }

    [Fact]
    public void UnpackagedManifest_UsesCompanionIdentityForSystemPrompts()
    {
        var manifest = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(),
            "src",
            "LuckyNemo.Tray.WinUI",
            "app.manifest"));

        Assert.Contains(@"<assemblyIdentity version=""1.0.0.0"" name=""LuckyNemo.Companion""/>", manifest);
        Assert.DoesNotContain(@"name=""LuckyNemo.Tray.WinUI""", manifest);
    }

    [Fact]
    public void ApprovalPopups_UseCompanionDisplayName()
    {
        var root = TestRepositoryPaths.GetRepositoryRoot();
        var pairingDialog = File.ReadAllText(Path.Combine(root, "src", "LuckyNemo.Tray.WinUI", "Dialogs", "PairingApprovalDialog.cs"));
        var recordingDialog = File.ReadAllText(Path.Combine(root, "src", "LuckyNemo.Tray.WinUI", "Dialogs", "RecordingConsentDialog.cs"));
        var execPrompt = File.ReadAllText(Path.Combine(root, "src", "LuckyNemo.Tray.WinUI", "Services", "ExecApprovalPromptService.cs"));

        Assert.Contains("AppIdentity.DisplayName", pairingDialog);
        Assert.Contains("AppIdentity.DisplayName", recordingDialog);
        Assert.Contains("AppIdentity.DisplayName", execPrompt);
        Assert.DoesNotContain("LuckyNemo · Permission Request", File.ReadAllText(Path.Combine(root, "src", "LuckyNemo.Tray.WinUI", "Strings", "en-us", "Resources.resw")));
        Assert.Contains("NativePromptTitle", execPrompt);
        Assert.DoesNotContain("LuckyNemo.Tray.WinUI", pairingDialog);
        Assert.DoesNotContain("LuckyNemo.Tray.WinUI", recordingDialog);
        Assert.DoesNotContain("LuckyNemo.Tray.WinUI", execPrompt);
    }
}
