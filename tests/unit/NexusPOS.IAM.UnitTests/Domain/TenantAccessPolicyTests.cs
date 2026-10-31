using FluentAssertions;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain.Enums;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.IAM.UnitTests.Domain;

public sealed class TenantAccessPolicyTests
{
    private static TenantContext Tenant(bool isActive) => new(Guid.NewGuid(), null, "Cafe", isActive);

    [Fact]
    public void IsBlocked_SuspendedTenant_BlocksStaff()
    {
        TenantAccessPolicy.IsBlocked(Tenant(isActive: false), [UserRole.Owner]).Should().BeTrue();
    }

    [Fact]
    public void IsBlocked_ActiveTenant_Allows()
    {
        TenantAccessPolicy.IsBlocked(Tenant(isActive: true), [UserRole.Staff]).Should().BeFalse();
    }

    [Fact]
    public void IsBlocked_NoTenant_Allows()
    {
        TenantAccessPolicy.IsBlocked(null, [UserRole.Staff]).Should().BeFalse();
    }

    [Fact]
    public void IsBlocked_SuperAdmin_NeverBlocked()
    {
        TenantAccessPolicy.IsBlocked(Tenant(isActive: false), [UserRole.SuperAdmin]).Should().BeFalse();
    }
}
