using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.IAM.Domain.Entities;

public sealed class PasskeyCredential : Entity<Guid>
{
    public UserId UserId { get; private set; } = null!;
    public byte[] CredentialId { get; private set; } = null!;
    public byte[] PublicKey { get; private set; } = null!;
    public uint SignCount { get; private set; }
    public string DeviceName { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }
    public DateTime? LastUsedAt { get; private set; }

    private PasskeyCredential() { }

    public static PasskeyCredential Create(
        UserId userId,
        byte[] credentialId,
        byte[] publicKey,
        string deviceName)
    {
        return new PasskeyCredential
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CredentialId = credentialId,
            PublicKey = publicKey,
            SignCount = 0,
            DeviceName = deviceName,
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void UpdateSignCount(uint newSignCount)
    {
        SignCount = newSignCount;
        LastUsedAt = DateTime.UtcNow;
    }
}
