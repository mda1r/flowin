using System.Security.Cryptography;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.IAM.Domain.Entities;

public sealed class TOTPSecret : Entity<Guid>
{
    public UserId UserId { get; private set; } = null!;
    public string SecretBase32 { get; private set; } = null!;
    public bool IsEnabled { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? EnabledAt { get; private set; }

    private TOTPSecret() { }

    public static TOTPSecret Create(UserId userId)
    {
        return new TOTPSecret
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            SecretBase32 = GenerateBase32Secret(),
            IsEnabled = false,
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void Enable()
    {
        IsEnabled = true;
        EnabledAt = DateTime.UtcNow;
    }

    public void Disable()
    {
        IsEnabled = false;
    }

    private static string GenerateBase32Secret()
    {
        byte[] bytes = RandomNumberGenerator.GetBytes(20);
        const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        System.Text.StringBuilder sb = new(32);

        for (int i = 0; i < bytes.Length - 1; i += 5)
        {
            sb.Append(Alphabet[(bytes[i] >> 3) & 0x1F]);
            sb.Append(Alphabet[((bytes[i] & 0x07) << 2) | ((bytes[i + 1] >> 6) & 0x03)]);
            sb.Append(Alphabet[(bytes[i + 1] >> 1) & 0x1F]);
            sb.Append(Alphabet[((bytes[i + 1] & 0x01) << 4) | ((bytes[i + 2] >> 4) & 0x0F)]);
            sb.Append(Alphabet[((bytes[i + 2] & 0x0F) << 1) | ((bytes[i + 3] >> 7) & 0x01)]);
            sb.Append(Alphabet[(bytes[i + 3] >> 2) & 0x1F]);
            sb.Append(Alphabet[((bytes[i + 3] & 0x03) << 3) | ((bytes[i + 4] >> 5) & 0x07)]);
            sb.Append(Alphabet[bytes[i + 4] & 0x1F]);
        }

        return sb.ToString();
    }
}
