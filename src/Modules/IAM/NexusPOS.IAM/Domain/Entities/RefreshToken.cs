using System.Security.Cryptography;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.IAM.Domain.Entities;

public sealed class RefreshToken : Entity<Guid>
{
    public UserId UserId { get; private set; } = null!;
    public string Token { get; private set; } = null!;
    public DateTime ExpiresAt { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public bool IsRevoked { get; private set; }
    public string? DeviceInfo { get; private set; }

    private RefreshToken() { }

    public static RefreshToken Create(UserId userId, int expiryDays, string? deviceInfo = null)
    {
        return new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant(),
            ExpiresAt = DateTime.UtcNow.AddDays(expiryDays),
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false,
            DeviceInfo = deviceInfo,
        };
    }

    public bool IsExpired => DateTime.UtcNow > ExpiresAt;
    public bool IsActive => !IsRevoked && !IsExpired;

    public void Revoke()
    {
        IsRevoked = true;
    }
}
