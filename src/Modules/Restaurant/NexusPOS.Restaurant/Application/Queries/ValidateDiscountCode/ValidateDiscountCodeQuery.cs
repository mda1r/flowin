using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ValidateDiscountCode;

public sealed record ValidateDiscountCodeQuery(
    Guid TenantId,
    string Code,
    decimal OrderAmount) : IQuery<ValidateDiscountCodeResponse>;
