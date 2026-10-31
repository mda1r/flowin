using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.CancelReservation;

public sealed record CancelReservationCommand(Guid ReservationId, Guid BranchId) : ICommand<ReservationResponse>;
