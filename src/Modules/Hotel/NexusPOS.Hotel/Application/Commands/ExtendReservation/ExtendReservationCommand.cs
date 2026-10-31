using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.ExtendReservation;

public sealed record ExtendReservationCommand(
    Guid ReservationId,
    Guid BranchId,
    DateTime NewCheckOut) : ICommand<ReservationResponse>;
