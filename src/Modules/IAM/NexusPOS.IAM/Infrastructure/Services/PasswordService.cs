using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.Infrastructure.Services;

internal sealed class PasswordService : IPasswordService
{
    private const int DegreeOfParallelism = 2;
    private const int MemorySize = 65536;
    private const int Iterations = 3;
    private const int HashLength = 32;
    private const int SaltLength = 32;

    public PasswordHash HashPassword(string plaintext)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltLength);
        byte[] hash = ComputeHash(plaintext, salt);

        string encoded = string.Concat(
            "$argon2id$v=19$m=65536,t=3,p=2$",
            Convert.ToBase64String(salt),
            "$",
            Convert.ToBase64String(hash));

        return new PasswordHash(encoded);
    }

    public bool VerifyPassword(string plaintext, PasswordHash passwordHash)
    {
        string[] parts = passwordHash.Hash.Split('$');

        if (parts.Length != 6 || parts[1] != "argon2id")
        {
            return false;
        }

        byte[] salt;
        byte[] expectedHash;

        try
        {
            salt = Convert.FromBase64String(parts[4]);
            expectedHash = Convert.FromBase64String(parts[5]);
        }
        catch (FormatException)
        {
            return false;
        }

        byte[] actualHash = ComputeHash(plaintext, salt);
        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    private static byte[] ComputeHash(string plaintext, byte[] salt)
    {
        using Argon2id argon2 = new(Encoding.UTF8.GetBytes(plaintext))
        {
            Salt = salt,
            DegreeOfParallelism = DegreeOfParallelism,
            MemorySize = MemorySize,
            Iterations = Iterations,
        };

        return argon2.GetBytes(HashLength);
    }
}
