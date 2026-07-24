using Xunit;

namespace LuckyNemo.Shared.Tests;

[CollectionDefinition("AppVersionInfo", DisableParallelization = true)]
public sealed class AppVersionInfoTestCollection
{
    public const string Name = "AppVersionInfo";
}
