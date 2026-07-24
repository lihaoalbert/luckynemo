using System.Runtime.CompilerServices;

namespace LuckyNemo.Tray.Tests;

internal static class TestRepositoryPaths
{
    public static string GetRepositoryRoot([CallerFilePath] string callerFilePath = "")
    {
        var envRepoRoot = Environment.GetEnvironmentVariable("LUCKYNEMO_REPO_ROOT");
        if (!string.IsNullOrWhiteSpace(envRepoRoot) && Directory.Exists(envRepoRoot))
            return envRepoRoot;

        var root = FindRepositoryRoot(AppContext.BaseDirectory);
        if (root != null)
            return root;

        if (!string.IsNullOrWhiteSpace(callerFilePath) && File.Exists(callerFilePath))
        {
            root = FindRepositoryRoot(Path.GetDirectoryName(callerFilePath)!);
            if (root != null)
                return root;
        }

        throw new InvalidOperationException(
            "Could not find repository root. Set LUCKYNEMO_REPO_ROOT to the repo path.");
    }

    private static string? FindRepositoryRoot(string startDirectory)
    {
        var directory = new DirectoryInfo(startDirectory);
        while (directory != null)
        {
            if (IsRepositoryRoot(directory.FullName))
                return directory.FullName;

            directory = directory.Parent;
        }

        return null;
    }

    private static bool IsRepositoryRoot(string path)
        => (File.Exists(Path.Combine(path, "luckynemo-windows-node.slnx")) &&
            Directory.Exists(Path.Combine(path, "src"))) ||
           ((Directory.Exists(Path.Combine(path, ".git")) ||
             File.Exists(Path.Combine(path, ".git"))) &&
            File.Exists(Path.Combine(path, "README.md")));
}
