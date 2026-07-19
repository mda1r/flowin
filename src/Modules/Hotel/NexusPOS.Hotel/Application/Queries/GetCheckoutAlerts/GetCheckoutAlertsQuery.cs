using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.GetCheckoutAlerts;

public sealed record GetCheckoutAlertsQuery(Guid BranchId) : IQuery<IReadOnlyList<ReservationResponse>>;
