using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.Application.Services;

public interface IPasswordService
{
    PasswordHash HashPassword(string plaintext);
    bool VerifyPassword(string plaintext, PasswordHash hash);
}
