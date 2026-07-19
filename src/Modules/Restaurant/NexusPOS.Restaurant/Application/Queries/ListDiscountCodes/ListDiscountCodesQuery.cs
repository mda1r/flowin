using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListDiscountCodes;

public sealed record ListDiscountCodesQuery(Guid TenantId) : IQuery<IReadOnlyList<DiscountCodeResponse>>;
