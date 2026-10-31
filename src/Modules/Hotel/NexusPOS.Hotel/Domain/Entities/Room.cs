using ErrorOr;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.Events;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Hotel.Domain.Entities;

public sealed class Room : AggregateRoot<RoomId>
{
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public RoomType RoomType { get; private set; }
    public string RoomNumber { get; private set; } = string.Empty;
    public int Floor { get; private set; }
    public int Capacity { get; private set; }
    public decimal NightlyRate { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public RoomStatus Status { get; private set; }
    public CleaningStatus CleaningStatus { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Room() { }

    public static ErrorOr<Room> Create(
        Guid tenantId,
        Guid branchId,
        RoomType roomType,
        string roomNumber,
        int floor,
        int capacity,
        decimal nightlyRate,
        string currency,
        string? description = null)
    {
        if (nightlyRate <= 0)
        {
            return HotelErrors.InvalidNightlyRate;
        }

        if (capacity <= 0)
        {
            return HotelErrors.InvalidCapacity;
        }

        Room room = new()
        {
            Id = new RoomId(Guid.NewGuid()),
            TenantId = tenantId,
            BranchId = branchId,
            RoomType = roomType,
            RoomNumber = roomNumber.Trim(),
            Floor = floor,
            Capacity = capacity,
            NightlyRate = nightlyRate,
            Currency = currency.Trim().ToUpperInvariant(),
            Status = RoomStatus.Available,
            CleaningStatus = CleaningStatus.Clean,
            Description = description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        room.RaiseDomainEvent(new RoomCreatedDomainEvent(
            room.Id.Value, tenantId, branchId, room.RoomNumber, nightlyRate));

        return room;
    }

    public ErrorOr<Success> SetStatus(RoomStatus newStatus)
    {
        if (newStatus == Status)
        {
            return HotelErrors.RoomStatusUnchanged;
        }

        if (Status == RoomStatus.Occupied && newStatus == RoomStatus.Available)
        {
            return HotelErrors.InvalidStatusTransition;
        }

        Status = newStatus;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> OccupyRoom()
    {
        if (!IsActive)
        {
            return HotelErrors.RoomInactive;
        }

        if (Status == RoomStatus.Occupied)
        {
            return HotelErrors.RoomAlreadyOccupied;
        }

        if (Status == RoomStatus.Maintenance)
        {
            return HotelErrors.RoomUnderMaintenance;
        }

        Status = RoomStatus.Occupied;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> VacateRoom()
    {
        if (Status != RoomStatus.Occupied)
        {
            return HotelErrors.RoomNotOccupied;
        }

        Status = RoomStatus.Available;
        CleaningStatus = CleaningStatus.NeedsClean;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    /// <summary>Frees the room after a cancelled check-in; nobody stayed, so it stays clean.</summary>
    public void ReleaseRoom()
    {
        if (Status != RoomStatus.Occupied)
        {
            return;
        }

        Status = RoomStatus.Available;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkClean()
    {
        CleaningStatus = CleaningStatus.Clean;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkNeedsClean()
    {
        CleaningStatus = CleaningStatus.NeedsClean;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkCleaningInProgress()
    {
        CleaningStatus = CleaningStatus.InProgress;
        UpdatedAt = DateTime.UtcNow;
    }

    public ErrorOr<Success> Deactivate()
    {
        if (Status == RoomStatus.Occupied)
        {
            return HotelErrors.RoomHasActiveReservation;
        }

        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }
}
