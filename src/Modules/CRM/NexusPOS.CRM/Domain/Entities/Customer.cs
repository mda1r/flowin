using ErrorOr;
using NexusPOS.CRM.Domain.Events;
using NexusPOS.CRM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.CRM.Domain.Entities;

public sealed class Customer : AggregateRoot<CustomerId>
{
    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? Address { get; private set; }
    public DateOnly? DateOfBirth { get; private set; }
    public int LoyaltyPoints { get; private set; }
    public string? Notes { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Customer() { }

    public static Customer Create(
        Guid tenantId,
        string name,
        string? email = null,
        string? phone = null,
        string? address = null,
        DateOnly? dateOfBirth = null,
        string? notes = null)
    {
        Customer customer = new()
        {
            Id = new CustomerId(Guid.NewGuid()),
            TenantId = tenantId,
            Name = name.Trim(),
            Email = email?.Trim(),
            Phone = phone?.Trim(),
            Address = address?.Trim(),
            DateOfBirth = dateOfBirth,
            LoyaltyPoints = 0,
            Notes = notes?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        customer.RaiseDomainEvent(new CustomerCreatedDomainEvent(customer.Id.Value, tenantId, customer.Name));
        return customer;
    }

    public void UpdateProfile(string name, string? email, string? phone, string? address, DateOnly? dateOfBirth, string? notes)
    {
        Name = name.Trim();
        Email = email?.Trim();
        Phone = phone?.Trim();
        Address = address?.Trim();
        DateOfBirth = dateOfBirth;
        Notes = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public ErrorOr<Success> AddLoyaltyPoints(int points)
    {
        if (points <= 0)
        {
            return CrmErrors.InvalidLoyaltyPoints;
        }

        LoyaltyPoints += points;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> RedeemLoyaltyPoints(int points)
    {
        if (points <= 0)
        {
            return CrmErrors.InvalidLoyaltyPoints;
        }

        if (points > LoyaltyPoints)
        {
            return CrmErrors.InsufficientLoyaltyPoints;
        }

        LoyaltyPoints -= points;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
