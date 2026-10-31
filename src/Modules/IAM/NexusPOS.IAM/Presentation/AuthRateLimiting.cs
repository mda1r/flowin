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

    /// <summary>
    /// The caller's IP. Behind a reverse proxy (Railway) the socket address is the proxy's, so the client is
    /// read from X-Forwarded-For. Only the entries appended by our own proxies are trusted: with one hop that is
    /// the right-most value, which a client cannot forge by sending its own header.
    /// </summary>
    public static string ClientKey(HttpContext context, int trustedProxyHops) =>
        ResolveClientIp(
            context.Request.Headers["X-Forwarded-For"].ToString(),
            context.Connection.RemoteIpAddress?.ToString(),
            trustedProxyHops);

    public static string ResolveClientIp(string? forwardedFor, string? remoteIp, int trustedProxyHops)
    {
        if (trustedProxyHops > 0 && !string.IsNullOrWhiteSpace(forwardedFor))
        {
            string[] hops = forwardedFor.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (hops.Length > 0)
            {
                return hops[Math.Max(0, hops.Length - trustedProxyHops)];
            }
        }

        return string.IsNullOrWhiteSpace(remoteIp) ? "unknown" : remoteIp;
    }
}
