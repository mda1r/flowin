using FluentAssertions;
using NexusPOS.IAM.Presentation;

namespace NexusPOS.IAM.UnitTests.Presentation;

public sealed class AuthRateLimitingTests
{
    [Fact]
    public void ResolveClientIp_NoForwardedHeader_UsesSocketAddress()
    {
        AuthRateLimiting.ResolveClientIp(null, "10.0.0.5", trustedProxyHops: 1).Should().Be("10.0.0.5");
    }

    [Fact]
    public void ResolveClientIp_OneTrustedHop_UsesRightMostEntry()
    {
        // A client can prepend anything it likes; only the value our proxy appended is trusted.
        AuthRateLimiting.ResolveClientIp("1.1.1.1, 203.0.113.9", "10.0.0.5", trustedProxyHops: 1)
            .Should().Be("203.0.113.9");
    }

    [Fact]
    public void ResolveClientIp_TwoTrustedHops_SkipsInnerProxy()
    {
        AuthRateLimiting.ResolveClientIp("203.0.113.9, 172.16.0.2", "10.0.0.5", trustedProxyHops: 2)
            .Should().Be("203.0.113.9");
    }

    [Fact]
    public void ResolveClientIp_MoreHopsThanEntries_UsesLeftMostEntry()
    {
        AuthRateLimiting.ResolveClientIp("203.0.113.9", "10.0.0.5", trustedProxyHops: 3).Should().Be("203.0.113.9");
    }

    [Fact]
    public void ResolveClientIp_ZeroTrustedHops_IgnoresForwardedHeader()
    {
        AuthRateLimiting.ResolveClientIp("203.0.113.9", "10.0.0.5", trustedProxyHops: 0).Should().Be("10.0.0.5");
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData(" , ", "")]
    public void ResolveClientIp_NothingKnown_FallsBackToSharedKey(string? forwardedFor, string? remoteIp)
    {
        AuthRateLimiting.ResolveClientIp(forwardedFor, remoteIp, trustedProxyHops: 1).Should().Be("unknown");
    }

    [Fact]
    public void PolicyNames_AreDistinct()
    {
        string[] names = [AuthRateLimiting.RegisterPolicy, AuthRateLimiting.LoginPolicy, AuthRateLimiting.RefreshPolicy];
        names.Should().OnlyHaveUniqueItems();
    }
}
