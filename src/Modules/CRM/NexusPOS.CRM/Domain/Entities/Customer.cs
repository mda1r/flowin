using ErrorOr;
using NexusPOS.CRM.Domain.Events;
using NexusPOS.CRM.Domain.Marketing;
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

    // The customer agreed to receive offers on WhatsApp; only these customers are reachable by campaigns.
    public bool MarketingOptIn { get; private set; }
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
        string? notes = null,
        bool marketingOptIn = false)
    {
        Customer customer = new()
        {
            Id = new CustomerId(Guid.NewGuid()),
            TenantId = tenantId,
            Name = name.Trim(),
            Email = Clean(email),
            Phone = CleanPhone(phone),
            Address = Clean(address),
            DateOfBirth = dateOfBirth,
            LoyaltyPoints = 0,
            MarketingOptIn = marketingOptIn,
            Notes = Clean(notes),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        customer.RaiseDomainEvent(new CustomerCreatedDomainEvent(customer.Id.Value, tenantId, customer.Name));
        return customer;
    }

    public void UpdateProfile(
        string name, string? email, string? phone, string? address, DateOnly? dateOfBirth, string? notes,
        bool? marketingOptIn = null)
    {
        MarketingOptIn = marketingOptIn ?? MarketingOptIn;
        Name = name.Trim();
        Email = Clean(email);
        Phone = CleanPhone(phone);
        Address = Clean(address);
        DateOfBirth = dateOfBirth;
        Notes = Clean(notes);
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

    // Takes back points earned on a sale that was refunded, never below zero: points already spent stay spent.
    // Returns how many were actually taken.
    public int TakeBackLoyaltyPoints(int points)
    {
        int taken = Math.Clamp(points, 0, LoyaltyPoints);
        if (taken > 0)
        {
            LoyaltyPoints -= taken;
            UpdatedAt = DateTime.UtcNow;
        }

        return taken;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    // A blank field is no value at all, so two customers without an email never collide on the unique email index.
    internal static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // Phones are kept in one international form (+9665XXXXXXXX for a Saudi mobile) so the till finds a regular however
    // the number was typed and the same number cannot be signed up twice. The + keeps numbers from other countries
    // valid for WhatsApp campaigns. A number the rules do not recognise, like a landline, is kept as typed with 0-9 digits.
    internal static string? CleanPhone(string? value) =>
        WhatsAppPhone.Normalize(value) is string normalized
            ? "+" + normalized
            : Clean(value) is string raw ? WhatsAppPhone.ToAsciiDigits(raw) : null;
}
