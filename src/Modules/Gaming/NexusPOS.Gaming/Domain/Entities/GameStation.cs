using ErrorOr;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Domain.Events;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Gaming.Domain.Entities;

public sealed class GameStation : AggregateRoot<GameStationId>
{
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public StationType StationType { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public decimal HourlyRate { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public StationStatus Status { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private GameStation() { }

    public static ErrorOr<GameStation> Create(
        Guid tenantId,
        Guid branchId,
        StationType stationType,
        string name,
        decimal hourlyRate,
        string currency)
    {
        if (hourlyRate <= 0)
        {
            return GamingErrors.InvalidHourlyRate;
        }

        GameStation station = new()
        {
            Id = new GameStationId(Guid.NewGuid()),
            TenantId = tenantId,
            BranchId = branchId,
            StationType = stationType,
            Name = name.Trim(),
            HourlyRate = hourlyRate,
            Currency = currency.Trim().ToUpperInvariant(),
            Status = StationStatus.Available,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        return station;
    }

    public ErrorOr<Success> StartSession()
    {
        if (Status != StationStatus.Available)
        {
            return GamingErrors.StationNotAvailable;
        }

        Status = StationStatus.InUse;
        UpdatedAt = DateTime.UtcNow;
        RaiseDomainEvent(new GameSessionStartedDomainEvent(Id.Value, TenantId, BranchId));
        return Result.Success;
    }

    public ErrorOr<Success> EndSession()
    {
        if (Status != StationStatus.InUse)
        {
            return GamingErrors.StationNotInUse;
        }

        Status = StationStatus.Available;
        UpdatedAt = DateTime.UtcNow;
        RaiseDomainEvent(new GameSessionEndedDomainEvent(Id.Value, TenantId, BranchId));
        return Result.Success;
    }

    // A running session must be ended (and billed) first, otherwise it would be stranded on a station nobody can use.
    public ErrorOr<Success> SetMaintenance()
    {
        if (Status == StationStatus.InUse)
        {
            return GamingErrors.StationInUse;
        }

        Status = StationStatus.Maintenance;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    // Back in service after maintenance. A session left active from before the fix puts the station back
    // to InUse, so it can be ended and billed instead of being hidden behind a free station.
    public ErrorOr<Success> ReturnToService(bool hasActiveSession = false)
    {
        if (Status != StationStatus.Maintenance)
        {
            return GamingErrors.StationNotInMaintenance;
        }

        Status = hasActiveSession ? StationStatus.InUse : StationStatus.Available;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    // The station's own rate unless an owner or manager set another one for this session.
    public ErrorOr<decimal> ResolveSessionRate(decimal? requestedRate, bool canOverrideRate)
    {
        if (requestedRate is not decimal rate || rate == HourlyRate)
        {
            return HourlyRate;
        }

        if (!canOverrideRate)
        {
            return GamingErrors.RateOverrideNotAllowed;
        }

        if (rate <= 0)
        {
            return GamingErrors.InvalidHourlyRate;
        }

        return rate;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
