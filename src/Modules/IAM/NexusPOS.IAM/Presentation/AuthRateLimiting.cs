using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.Http;

namespace NexusPOS.IAM.Presentation;

/// <summary>
/// Rate-limit policy names for the auth endpoints and the client key they are partitioned by.
/// Every limit is per client IP, so one busy shop can never exhaust the budget of another.
/// </summary>
public static class AuthRateLimiting
{
    /// <summary>Account sign-up.</summary>
    public const string RegisterPolicy = "auth";

    /// <summary>Password sign-in. Stricter than refresh; per-account guessing is also capped by the lockout.</summary>
    public const string LoginPolicy = "auth-login";

    /// <summary>Token refresh and logout, which every open till hits on its own every few minutes.</summary>
    public const string RefreshPolicy = "auth-refresh";

    // Where a reverse proxy can sit when no explicit proxy list is configured: private, shared (CGNAT,
    // used by platform edge networks) and link-local space. A public socket address is a direct client.
    private static readonly IPNetwork[] _privateRanges =
    [
        IPNetwork.Parse("10.0.0.0/8"),
        IPNetwork.Parse("172.16.0.0/12"),
        IPNetwork.Parse("192.168.0.0/16"),
        IPNetwork.Parse("100.64.0.0/10"),
        IPNetwork.Parse("169.254.0.0/16"),
        IPNetwork.Parse("fc00::/7"),
        IPNetwork.Parse("fe80::/10"),
    ];

    /// <summary>
    /// The caller's IP. Behind a reverse proxy (Railway) the socket address is the proxy's, so the client is
    /// read from X-Forwarded-For. The header is only honoured when the socket peer is a trusted proxy (one of
    /// <paramref name="knownProxies"/>, or a loopback/private address when none are configured), and then only
    /// the entries appended by our own proxies are used: with one hop that is the right-most value, which a
    /// client cannot forge by sending its own header.
    /// </summary>
    public static string ClientKey(HttpContext context, int trustedProxyHops, IReadOnlyList<IPNetwork> knownProxies) =>
        ResolveClientIp(
            context.Request.Headers["X-Forwarded-For"].ToString(),
            context.Connection.RemoteIpAddress,
            trustedProxyHops,
            knownProxies);

    public static string ResolveClientIp(
        string? forwardedFor, IPAddress? remoteIp, int trustedProxyHops, IReadOnlyList<IPNetwork>? knownProxies = null)
    {
        IPAddress? remote = remoteIp is null ? null : Normalize(remoteIp);

        if (trustedProxyHops > 0 && remote is not null && !string.IsNullOrWhiteSpace(forwardedFor)
            && IsTrustedProxy(remote, knownProxies))
        {
            string[] hops = forwardedFor.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            // Anything that is not an address (garbage, host names, ports) falls back to the socket peer,
            // and parsing canonicalises the value so one client cannot spell itself many ways.
            if (hops.Length > 0 && IPAddress.TryParse(hops[Math.Max(0, hops.Length - trustedProxyHops)], out IPAddress? client))
            {
                return Normalize(client).ToString();
            }
        }

        return remote?.ToString() ?? "unknown";
    }

    /// <summary>Parses RateLimit:KnownProxies entries, each a single address or a CIDR range; invalid entries are skipped.</summary>
    public static IPNetwork[] ParseKnownProxies(IEnumerable<string>? entries)
    {
        List<IPNetwork> networks = [];
        foreach (string entry in entries ?? [])
        {
            string value = entry.Trim();
            if (IPNetwork.TryParse(value, out IPNetwork network))
            {
                networks.Add(network);
            }
            else if (IPAddress.TryParse(value, out IPAddress? address))
            {
                address = Normalize(address);
                networks.Add(new IPNetwork(address, address.AddressFamily == AddressFamily.InterNetwork ? 32 : 128));
            }
        }

        return [.. networks];
    }

    private static bool IsTrustedProxy(IPAddress remote, IReadOnlyList<IPNetwork>? knownProxies)
    {
        if (knownProxies is { Count: > 0 })
        {
            return knownProxies.Any(network => network.Contains(remote));
        }

        return IPAddress.IsLoopback(remote) || _privateRanges.Any(network => network.Contains(remote));
    }

    private static IPAddress Normalize(IPAddress address) =>
        address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
}
