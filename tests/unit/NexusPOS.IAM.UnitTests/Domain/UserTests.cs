using FluentAssertions;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Domain.Events;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.IAM.UnitTests.Domain;

public sealed class UserTests
{
    private static Email ValidEmail => Email.Create("test@example.com").Value;

    [Fact]
    public void Create_ValidInputs_CreatesUserWithDefaultRole()
    {
        User user = User.Create(ValidEmail, "John", "Doe");

        user.Email.Value.Should().Be("test@example.com");
        user.FirstName.Should().Be("John");
        user.LastName.Should().Be("Doe");
        user.FullName.Should().Be("John Doe");
        user.IsActive.Should().BeTrue();
        user.IsEmailVerified.Should().BeFalse();
        user.Roles.Should().ContainSingle().Which.Should().Be(UserRole.Staff);
    }

    [Fact]
    public void Create_ValidInputs_RaisesUserRegisteredDomainEvent()
    {
        User user = User.Create(ValidEmail, "Jane", "Smith");

        IDomainEvent ev = user.DomainEvents.Should().ContainSingle().Subject;
        ev.Should().BeOfType<UserRegisteredDomainEvent>();

        UserRegisteredDomainEvent registered = (UserRegisteredDomainEvent)ev;
        registered.UserId.Should().Be(user.Id.Value);
        registered.Email.Should().Be("test@example.com");
    }

    [Fact]
    public void SetPassword_SetsPasswordHash()
    {
        User user = User.Create(ValidEmail, "A", "B");
        PasswordHash hash = new("$argon2id$...");

        user.SetPassword(hash);

        user.PasswordHash.Should().Be(hash);
    }

    [Fact]
    public void RecordFailedLogin_BelowThreshold_DoesNotLock()
    {
        User user = User.Create(ValidEmail, "A", "B");

        user.RecordFailedLogin();
        user.RecordFailedLogin();
        user.RecordFailedLogin();
        user.RecordFailedLogin();

        user.IsLockedOut.Should().BeFalse();
        user.FailedLoginAttempts.Should().Be(4);
    }

    [Fact]
    public void RecordFailedLogin_AtThreshold_LocksAccount()
    {
        User user = User.Create(ValidEmail, "A", "B");

        for (int i = 0; i < 5; i++)
        {
            user.RecordFailedLogin();
        }

        user.IsLockedOut.Should().BeTrue();
        user.LockedUntil.Should().NotBeNull();

        IDomainEvent lockedEvent = user.DomainEvents
            .Should().Contain(e => e is UserLockedOutDomainEvent)
            .Subject;
        ((UserLockedOutDomainEvent)lockedEvent).UserId.Should().Be(user.Id.Value);
    }

    [Fact]
    public void RecordSuccessfulLogin_ResetsFailedAttempts()
    {
        User user = User.Create(ValidEmail, "A", "B");
        user.RecordFailedLogin();
        user.RecordFailedLogin();

        user.RecordSuccessfulLogin();

        user.FailedLoginAttempts.Should().Be(0);
        user.LockedUntil.Should().BeNull();
        user.LastLoginAt.Should().NotBeNull();
    }

    [Fact]
    public void CreateRefreshToken_AddsTokenToCollection()
    {
        User user = User.Create(ValidEmail, "A", "B");

        RefreshToken token = user.CreateRefreshToken(7);

        user.RefreshTokens.Should().ContainSingle();
        token.IsActive.Should().BeTrue();
        token.Token.Should().HaveLength(64);
    }

    [Fact]
    public void RevokeRefreshToken_ActiveToken_RevokesIt()
    {
        User user = User.Create(ValidEmail, "A", "B");
        RefreshToken token = user.CreateRefreshToken(7);

        user.RevokeRefreshToken(token.Token);

        token.IsRevoked.Should().BeTrue();
        token.IsActive.Should().BeFalse();
    }

    [Fact]
    public void RevokeAllRefreshTokens_RevokesAllActive()
    {
        User user = User.Create(ValidEmail, "A", "B");
        RefreshToken first = user.CreateRefreshToken(7);
        RefreshToken second = user.CreateRefreshToken(7);

        user.RevokeAllRefreshTokens();

        first.IsRevoked.Should().BeTrue();
        second.IsRevoked.Should().BeTrue();
    }

    [Fact]
    public void AddRole_NewRole_AddsToList()
    {
        User user = User.Create(ValidEmail, "A", "B");

        user.AddRole(UserRole.Manager);

        user.Roles.Should().Contain(UserRole.Manager);
        user.Roles.Should().HaveCount(2);
    }

    [Fact]
    public void AddRole_DuplicateRole_DoesNotAddTwice()
    {
        User user = User.Create(ValidEmail, "A", "B");

        user.AddRole(UserRole.Staff);

        user.Roles.Should().HaveCount(1);
    }

    [Fact]
    public void Deactivate_SetsInactiveAndRevokesTokens()
    {
        User user = User.Create(ValidEmail, "A", "B");
        RefreshToken token = user.CreateRefreshToken(7);

        user.Deactivate();

        user.IsActive.Should().BeFalse();
        token.IsRevoked.Should().BeTrue();
    }

    [Fact]
    public void VerifyEmail_SetsEmailVerifiedTrue()
    {
        User user = User.Create(ValidEmail, "A", "B");

        user.VerifyEmail();

        user.IsEmailVerified.Should().BeTrue();
    }
}
