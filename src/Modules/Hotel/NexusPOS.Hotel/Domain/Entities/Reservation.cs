using ErrorOr;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Hotel.Domain.Entities;

public sealed class Reservation : AggregateRoot<ReservationId>
{
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid RoomId { get; private set; }
    public string GuestName { get; private set; } = string.Empty;
    public string GuestNationalId { get; private set; } = string.Empty;
    public string GuestPhone { get; private set; } = string.Empty;
    public DateTime CheckIn { get; private set; }
    public DateTime CheckOut { get; private set; }
    public int Nights { get; private set; }
    public decimal RatePerNight { get; private set; }
    public decimal TotalAmount { get; private set; }
    public ReservationStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Reservation() { }

    public static ErrorOr<Reservation> Create(
        Guid tenantId,
        Guid branchId,
        Guid roomId,
        string guestName,
        string guestNationalId,
        string guestPhone,
        DateTime checkIn,
        DateTime checkOut,
        decimal ratePerNight,
        string? notes = null)
    {
        int nights = (checkOut.Date - checkIn.Date).Days;

        if (nights <= 0)
        {
            return HotelErrors.InvalidCheckoutDate;
        }

        if (ratePerNight <= 0)
        {
            return HotelErrors.InvalidNightlyRate;
        }

        return new Reservation
        {
            Id = new ReservationId(Guid.NewGuid()),
            TenantId = tenantId,
            BranchId = branchId,
            RoomId = roomId,
            GuestName = guestName.Trim(),
            GuestNationalId = guestNationalId.Trim(),
            GuestPhone = guestPhone.Trim(),
            CheckIn = checkIn,
            CheckOut = checkOut,
            Nights = nights,
            RatePerNight = ratePerNight,
            TotalAmount = nights * ratePerNight,
            Status = ReservationStatus.Active,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public ErrorOr<Success> Complete()
    {
        if (Status != ReservationStatus.Active)
        {
            return HotelErrors.ReservationNotActive;
        }

        Status = ReservationStatus.CheckedOut;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> Cancel()
    {
        if (Status != ReservationStatus.Active)
        {
            return HotelErrors.ReservationNotActive;
        }

        Status = ReservationStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }
}
