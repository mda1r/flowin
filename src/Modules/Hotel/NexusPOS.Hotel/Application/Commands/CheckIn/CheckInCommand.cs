using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.CheckIn;

public sealed record CheckInCommand(
    Guid TenantId,
    Guid BranchId,
    Guid RoomId,
    string GuestName,
    string GuestNationalId,
    string GuestPhone,
    DateTime CheckIn,
    DateTime CheckOut,
    decimal RatePerNight,
    string? Notes = null) : ICommand<ReservationResponse>;
