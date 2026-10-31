using ErrorOr;
using FluentAssertions;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.UnitTests.Domain;

public sealed class UserManagementRulesTests
{
    private static readonly string[] _owner = ["Owner"];
    private static readonly string[] _manager = ["Manager"];

    [Theory]
    [InlineData("Manager", UserRole.Manager)]
    [InlineData("Cashier", UserRole.Cashier)]
    [InlineData("Owner", UserRole.Owner)]
    public void ParseAssignableRole_KnownRole_Parses(string input, UserRole expected)
    {
        UserManagementRules.ParseAssignableRole(input).Value.Should().Be(expected);
    }

    [Theory]
    [InlineData("SuperAdmin")]
    [InlineData("99")]
    [InlineData("42")]
    [InlineData("Janitor")]
    [InlineData("")]
    public void ParseAssignableRole_SuperAdminOrUnknown_IsInvalid(string input)
    {
        ErrorOr<UserRole> result = UserManagementRules.ParseAssignableRole(input);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("User.InvalidRole");
    }

    [Fact]
    public void CanAssign_ManagerGrantingOwner_IsForbidden()
    {
        ErrorOr<Success> result = UserManagementRules.CanAssign(_manager, UserRole.Owner);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public void CanAssign_ManagerGrantingCashier_IsAllowed()
    {
        UserManagementRules.CanAssign(_manager, UserRole.Cashier).IsError.Should().BeFalse();
    }

    [Fact]
    public void CanAssign_OwnerGrantingOwner_IsAllowed()
    {
        UserManagementRules.CanAssign(_owner, UserRole.Owner).IsError.Should().BeFalse();
    }

    [Fact]
    public void CanManage_ManagerTouchingOwner_IsForbidden()
    {
        ErrorOr<Success> result = UserManagementRules.CanManage(_manager, [UserRole.Owner]);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(UserManagementRules.OwnerOnly);
    }

    [Fact]
    public void CanManage_ManagerTouchingCashier_IsAllowed()
    {
        UserManagementRules.CanManage(_manager, [UserRole.Cashier]).IsError.Should().BeFalse();
    }

    [Fact]
    public void CanManage_OwnerTouchingOwner_IsAllowed()
    {
        UserManagementRules.CanManage(_owner, [UserRole.Owner]).IsError.Should().BeFalse();
    }

    [Fact]
    public void CanManage_SuperAdminTarget_IsForbiddenEvenForOwner()
    {
        UserManagementRules.CanManage(_owner, [UserRole.SuperAdmin]).IsError.Should().BeTrue();
    }

    [Fact]
    public void EnsureNotLastOwner_OnlyActiveOwner_IsForbidden()
    {
        ErrorOr<Success> result = UserManagementRules.EnsureNotLastOwner([UserRole.Owner], targetIsActive: true, activeOwnerCount: 1);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(UserManagementRules.LastOwner);
    }

    [Fact]
    public void EnsureNotLastOwner_AnotherActiveOwnerExists_IsAllowed()
    {
        UserManagementRules.EnsureNotLastOwner([UserRole.Owner], targetIsActive: true, activeOwnerCount: 2)
            .IsError.Should().BeFalse();
    }

    [Fact]
    public void EnsureNotLastOwner_InactiveOwner_IsAllowed()
    {
        UserManagementRules.EnsureNotLastOwner([UserRole.Owner], targetIsActive: false, activeOwnerCount: 1)
            .IsError.Should().BeFalse();
    }

    [Fact]
    public void EnsureNotLastOwner_NonOwner_IsAllowed()
    {
        UserManagementRules.EnsureNotLastOwner([UserRole.Cashier], targetIsActive: true, activeOwnerCount: 1)
            .IsError.Should().BeFalse();
    }

    [Fact]
    public void SetRole_ReplacesAllRolesWithOne()
    {
        User user = User.Create(Email.Create("staff@example.com").Value, "Sara", "Ali");
        user.AddRole(UserRole.Cashier);

        user.SetRole(UserRole.Manager);

        user.Roles.Should().ContainSingle().Which.Should().Be(UserRole.Manager);
    }

    [Fact]
    public void Deactivate_ThenActivate_RevokesSessionsAndClearsLockout()
    {
        User user = User.Create(Email.Create("staff@example.com").Value, "Sara", "Ali");
        RefreshToken token = user.CreateRefreshToken(7);
        for (int i = 0; i < 5; i++)
        {
            user.RecordFailedLogin();
        }

        user.Deactivate();
        user.IsActive.Should().BeFalse();
        token.IsActive.Should().BeFalse();

        user.Activate();
        user.IsActive.Should().BeTrue();
        user.IsLockedOut.Should().BeFalse();
        user.FailedLoginAttempts.Should().Be(0);
    }

    [Fact]
    public void ResetPassword_ReplacesHashAndRevokesSessions()
    {
        User user = User.Create(Email.Create("staff@example.com").Value, "Sara", "Ali");
        RefreshToken token = user.CreateRefreshToken(7);
        PasswordHash newHash = new("new-hash");

        user.ResetPassword(newHash);

        user.PasswordHash.Should().Be(newHash);
        token.IsActive.Should().BeFalse();
    }
}
