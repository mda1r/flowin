using NexusPOS.Hotel.Domain.Enums;

namespace NexusPOS.Hotel.Application.Common;

public sealed record ReservationResponse(
    Guid Id,
    Guid RoomId,
    Guid TenantId,
    Guid BranchId,
    string GuestName,
    string GuestNationalId,
    string GuestPhone,
    DateTime CheckIn,
    DateTime CheckOut,
    int Nights,
    decimal RatePerNight,
    decimal TotalAmount,
    ReservationStatus Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt);
