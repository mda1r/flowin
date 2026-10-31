using NexusPOS.CRM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Queries.GetLoyaltyHistory;

public sealed record GetLoyaltyHistoryQuery(Guid CustomerId, Guid TenantId, int Limit = 50)
    : IQuery<IReadOnlyList<LoyaltyTransactionResponse>>;
