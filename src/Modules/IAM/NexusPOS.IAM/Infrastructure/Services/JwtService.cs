using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.IAM.Infrastructure.Settings;

namespace NexusPOS.IAM.Infrastructure.Services;

internal sealed class JwtService(
    RsaSecurityKey signingKey,
    IOptions<JwtSettings> options)
    : IJwtService
{
    private readonly JwtSecurityTokenHandler _tokenHandler = new();
    private readonly JwtSettings _settings = options.Value;

    public string GenerateAccessToken(
        UserId userId,
        Email email,
        string firstName,
        string lastName,
        IEnumerable<UserRole> roles,
        Guid? tenantId = null,
        Guid? branchId = null,
        string? businessType = null)
    {
        List<Claim> claims =
        [
            new Claim(JwtRegisteredClaimNames.Sub, userId.Value.ToString("D")),
            new Claim(JwtRegisteredClaimNames.Email, email.Value),
            new Claim(JwtRegisteredClaimNames.GivenName, firstName),
            new Claim(JwtRegisteredClaimNames.FamilyName, lastName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("D")),
            new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString("D")),
        ];

        if (tenantId.HasValue)
        {
            claims.Add(new Claim("tenant_id", tenantId.Value.ToString("D")));
        }

        if (branchId.HasValue)
        {
            claims.Add(new Claim("branch_id", branchId.Value.ToString("D")));
        }

        if (!string.IsNullOrEmpty(businessType))
        {
            claims.Add(new Claim("business_type", businessType));
        }

        foreach (UserRole role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role.ToString()));
        }

        JwtSecurityToken token = new(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(_settings.AccessTokenExpiryMinutes),
            signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.RsaSha256));

        return _tokenHandler.WriteToken(token);
    }
}
