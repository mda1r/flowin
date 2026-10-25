using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Gaming.Domain.Entities;

// A fixed-price block of play time (e.g. 3 hours for 50 SAR, VAT included), optionally limited to one station type.
public sealed class GamingPackage : Entity<Guid>
{
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public int DurationMinutes { get; private set; }
    public decimal Price { get; private set; }
    public StationType? StationType { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private GamingPackage() { }

    public static GamingPackage Create(Guid tenantId, Guid branchId, string name, int durationMinutes, decimal price, StationType? stationType) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            Name = name.Trim(),
            DurationMinutes = durationMinutes,
            Price = price,
            StationType = stationType,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

    public bool FitsStation(StationType stationType) => StationType is null || StationType == stationType;

    public void Deactivate() => IsActive = false;
}
