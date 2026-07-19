using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.ListReservations;

public sealed record ListReservationsQuery(Guid BranchId) : IQuery<IReadOnlyList<ReservationResponse>>;
