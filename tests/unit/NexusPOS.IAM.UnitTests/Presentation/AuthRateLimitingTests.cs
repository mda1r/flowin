using System.Net;
using FluentAssertions;
using NexusPOS.IAM.Presentation;

namespace NexusPOS.IAM.UnitTests.Presentation;

public sealed class AuthRateLimitingTests
{
    private static readonly IPAddress _proxy = IPAddress.Parse("10.0.0.5");

    [Fact]
    public void ResolveClientIp_NoForwardedHeader_UsesSocketAddress()
    {
        AuthRateLimiting.ResolveClientIp(null, _proxy, trustedProxyHops: 1).Should().Be("10.0.0.5");
    }

    [Fact]
    public void ResolveClientIp_OneTrustedHop_UsesRightMostEntry()
    {
        // A client can prepend anything it likes; only the value our proxy appended is trusted.
        AuthRateLimiting.ResolveClientIp("1.1.1.1, 203.0.113.9", _proxy, trustedProxyHops: 1)
            .Should().Be("203.0.113.9");
    }

    [Fact]
    public void ResolveClientIp_TwoTrustedHops_SkipsInnerProxy()
    {
        AuthRateLimiting.ResolveClientIp("203.0.113.9, 172.16.0.2", _proxy, trustedProxyHops: 2)
            .Should().Be("203.0.113.9");
    }

    [Fact]
    public void ResolveClientIp_MoreHopsThanEntries_UsesLeftMostEntry()
    {
        AuthRateLimiting.ResolveClientIp("203.0.113.9", _proxy, trustedProxyHops: 3).Should().Be("203.0.113.9");
    }

    [Fact]
    public void ResolveClientIp_ZeroTrustedHops_IgnoresForwardedHeader()
    {
        AuthRateLimiting.ResolveClientIp("203.0.113.9", _proxy, trustedProxyHops: 0).Should().Be("10.0.0.5");
    }

    [Theory]
    [InlineData("198.51.100.7")]
    [InlineData("2001:db8::1")]
    public void ResolveClientIp_DirectPublicClient_IgnoresForgedHeader(string remote)
    {
        // Reaching the API without a proxy must not let a client pick a fresh bucket per request.
        AuthRateLimiting.ResolveClientIp("203.0.113.9", IPAddress.Parse(remote), trustedProxyHops: 1)
            .Should().Be(remote);
    }

    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("::1")]
    [InlineData("100.64.3.4")]
    [InlineData("fd12::7")]
    [InlineData("::ffff:192.168.1.2")]
    public void ResolveClientIp_LoopbackOrPrivatePeer_TrustedAsProxy(string remote)
    {
        AuthRateLimiting.ResolveClientIp("203.0.113.9", IPAddress.Parse(remote), trustedProxyHops: 1)
            .Should().Be("203.0.113.9");
    }

    [Theory]
    [InlineData("not-an-ip")]
    [InlineData("203.0.113.9:4711")]
    [InlineData("<script>")]
    public void ResolveClientIp_NonAddressHop_FallsBackToSocketAddress(string forwardedFor)
    {
        AuthRateLimiting.ResolveClientIp(forwardedFor, _proxy, trustedProxyHops: 1).Should().Be("10.0.0.5");
    }

    [Fact]
    public void ResolveClientIp_ForwardedAddress_IsCanonicalised()
    {
        AuthRateLimiting.ResolveClientIp("::FFFF:203.0.113.9", _proxy, trustedProxyHops: 1).Should().Be("203.0.113.9");
    }

    [Fact]
    public void ResolveClientIp_KnownProxiesConfigured_OnlyThoseAreTrusted()
    {
        IPNetwork[] known = AuthRateLimiting.ParseKnownProxies(["10.1.0.0/16"]);

        AuthRateLimiting.ResolveClientIp("203.0.113.9", IPAddress.Parse("10.1.2.3"), 1, known).Should().Be("203.0.113.9");
        // A private peer outside the configured list is a client on the same network, not our proxy.
        AuthRateLimiting.ResolveClientIp("203.0.113.9", IPAddress.Parse("192.168.1.2"), 1, known).Should().Be("192.168.1.2");
    }

    [Fact]
    public void ParseKnownProxies_AcceptsAddressesAndRanges_SkipsInvalid()
    {
        IPNetwork[] known = AuthRateLimiting.ParseKnownProxies(["198.51.100.1", " 10.0.0.0/8 ", "2001:db8::/32", "nope", ""]);

        known.Should().HaveCount(3);
        known[0].Contains(IPAddress.Parse("198.51.100.1")).Should().BeTrue();
        known[0].Contains(IPAddress.Parse("198.51.100.2")).Should().BeFalse();
        AuthRateLimiting.ParseKnownProxies(null).Should().BeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData(" , ")]
    public void ResolveClientIp_NothingKnown_FallsBackToSharedKey(string? forwardedFor)
    {
        AuthRateLimiting.ResolveClientIp(forwardedFor, null, trustedProxyHops: 1).Should().Be("unknown");
    }

    [Fact]
    public void PolicyNames_AreDistinct()
    {
        string[] names = [AuthRateLimiting.RegisterPolicy, AuthRateLimiting.LoginPolicy, AuthRateLimiting.RefreshPolicy];
        names.Should().OnlyHaveUniqueItems();
    }
}
