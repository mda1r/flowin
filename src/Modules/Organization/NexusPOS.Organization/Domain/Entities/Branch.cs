using NexusPOS.Organization.Domain.Enums;
using NexusPOS.Organization.Domain.Events;
using NexusPOS.Organization.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Organization.Domain.Entities;

public sealed class Branch : AggregateRoot<BranchId>
{
    public TenantId TenantId { get; private set; } = null!;
    public string Name { get; private set; } = null!;
    public BranchType Type { get; private set; }
    public Address? Address { get; private set; }
    public string? PhoneNumber { get; private set; }
    public string? Email { get; private set; }
    public bool IsActive { get; private set; }
    public bool IsMainBranch { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private Branch() { }

    public static Branch Create(
        TenantId tenantId,
        string name,
        BranchType type,
        bool isMainBranch = false)
    {
        Branch branch = new()
        {
            Id = new BranchId(Guid.NewGuid()),
            TenantId = tenantId,
            Name = name.Trim(),
            Type = type,
            IsActive = true,
            IsMainBranch = isMainBranch,
            CreatedAt = DateTime.UtcNow,
        };

        branch.RaiseDomainEvent(new BranchCreatedDomainEvent(branch.Id.Value, tenantId.Value, branch.Name));

        return branch;
    }

    public void Update(
        string name,
        BranchType type,
        Address? address,
        string? phoneNumber,
        string? email)
    {
        Name = name.Trim();
        Type = type;
        Address = address;
        PhoneNumber = phoneNumber?.Trim();
        Email = email?.Trim().ToLowerInvariant();
    }

    public void Deactivate()
    {
        IsActive = false;
        RaiseDomainEvent(new BranchDeactivatedDomainEvent(Id.Value, TenantId.Value));
    }

    public void Activate()
    {
        IsActive = true;
    }

    public static Branch CreateWithId(
        Guid id,
        TenantId tenantId,
        string name,
        BranchType type,
        bool isMainBranch = false)
    {
        return new Branch
        {
            Id = new BranchId(id),
            TenantId = tenantId,
            Name = name.Trim(),
            Type = type,
            IsActive = true,
            IsMainBranch = isMainBranch,
            CreatedAt = DateTime.UtcNow,
        };
    }
}
