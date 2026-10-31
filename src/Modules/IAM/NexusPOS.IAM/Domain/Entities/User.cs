using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Domain.Events;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.IAM.Domain.Entities;

public sealed class User : AggregateRoot<UserId>
{
    private const int MaxFailedAttempts = 5;
    private const int LockoutMinutes = 15;

    public Email Email { get; private set; } = null!;
    public string FirstName { get; private set; } = null!;
    public string LastName { get; private set; } = null!;
    public PasswordHash? PasswordHash { get; private set; }
    public Guid? TenantId { get; private set; }
    public bool IsEmailVerified { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? LastLoginAt { get; private set; }
    public int FailedLoginAttempts { get; private set; }
    public DateTime? LockedUntil { get; private set; }
    public TOTPSecret? TotpSecret { get; private set; }

    public List<UserRole> Roles { get; private set; } = [];
    public List<RefreshToken> RefreshTokens { get; private set; } = [];
    public List<PasskeyCredential> PasskeyCredentials { get; private set; } = [];

    public bool IsLockedOut => LockedUntil.HasValue && LockedUntil.Value > DateTime.UtcNow;
    public string FullName => $"{FirstName} {LastName}";

    private User() { }

    public static User Create(Email email, string firstName, string lastName, Guid? tenantId = null)
    {
        User user = new()
        {
            Id = new UserId(Guid.NewGuid()),
            Email = email,
            FirstName = firstName,
            LastName = lastName,
            TenantId = tenantId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            Roles = [UserRole.Staff],
        };

        user.RaiseDomainEvent(new UserRegisteredDomainEvent(user.Id.Value, user.Email.Value));

        return user;
    }

    public void SetPassword(PasswordHash passwordHash)
    {
        PasswordHash = passwordHash;
    }

    public void ChangePassword(PasswordHash newHash)
    {
        PasswordHash = newHash;
        RaiseDomainEvent(new PasswordChangedDomainEvent(Id.Value, Email.Value));
    }

    public void RecordSuccessfulLogin()
    {
        FailedLoginAttempts = 0;
        LockedUntil = null;
        LastLoginAt = DateTime.UtcNow;
        RaiseDomainEvent(new UserLoggedInDomainEvent(Id.Value, Email.Value));
    }

    public void RecordFailedLogin()
    {
        FailedLoginAttempts++;

        if (FailedLoginAttempts >= MaxFailedAttempts)
        {
            LockedUntil = DateTime.UtcNow.AddMinutes(LockoutMinutes);
            RaiseDomainEvent(new UserLockedOutDomainEvent(Id.Value, Email.Value));
        }
    }

    public RefreshToken CreateRefreshToken(int expiryDays, string? deviceInfo = null)
    {
        RefreshToken token = RefreshToken.Create(Id, expiryDays, deviceInfo);
        RefreshTokens.Add(token);
        return token;
    }

    public void RevokeRefreshToken(string token)
    {
        RefreshToken? rt = RefreshTokens.FirstOrDefault(t => t.Token == token && t.IsActive);
        rt?.Revoke();
    }

    public void RevokeAllRefreshTokens()
    {
        foreach (RefreshToken rt in RefreshTokens.Where(t => t.IsActive))
        {
            rt.Revoke();
        }
    }

    public void AddRole(UserRole role)
    {
        if (!Roles.Contains(role))
        {
            Roles.Add(role);
        }
    }

    public void RemoveRole(UserRole role)
    {
        Roles.Remove(role);
    }

    public void AddPasskeyCredential(PasskeyCredential credential)
    {
        PasskeyCredentials.Add(credential);
    }

    public void SetTotpSecret(TOTPSecret secret)
    {
        TotpSecret = secret;
    }

    public void VerifyEmail()
    {
        IsEmailVerified = true;
    }

    public void UpdateProfile(string firstName, string lastName)
    {
        FirstName = firstName;
        LastName = lastName;
    }

    public void Deactivate()
    {
        IsActive = false;
        RevokeAllRefreshTokens();
    }
}
