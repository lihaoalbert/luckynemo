using System;
using Xunit;

namespace LuckyNemo.Shared.Tests;

public sealed class IntegrationFactAttribute : FactAttribute
{
    private const string EnvVar = "LUCKYNEMO_RUN_INTEGRATION";

    public IntegrationFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(EnvVar)))
        {
            Skip = $"Integration tests disabled. Set {EnvVar}=1 to enable.";
        }
    }
}

public sealed class IntegrationTheoryAttribute : TheoryAttribute
{
    private const string EnvVar = "LUCKYNEMO_RUN_INTEGRATION";

    public IntegrationTheoryAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(EnvVar)))
        {
            Skip = $"Integration tests disabled. Set {EnvVar}=1 to enable.";
        }
    }
}
