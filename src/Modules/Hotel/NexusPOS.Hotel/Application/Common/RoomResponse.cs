using NexusPOS.Hotel.Domain.Enums;

namespace NexusPOS.Hotel.Application.Common;

public sealed record RoomResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    RoomType RoomType,
    string RoomNumber,
    int Floor,
    int Capacity,
    decimal NightlyRate,
    string Currency,
    RoomStatus Status,
    CleaningStatus CleaningStatus,
    string? Description,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool CheckOutAlert = false,
    ReservationResponse? ActiveReservation = null);
