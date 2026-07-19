using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.CheckOut;

public sealed record CheckOutCommand(Guid ReservationId, Guid BranchId) : ICommand<ReservationResponse>;
