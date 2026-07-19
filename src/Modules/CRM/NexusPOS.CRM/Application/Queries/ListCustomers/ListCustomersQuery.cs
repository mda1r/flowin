using NexusPOS.CRM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Queries.ListCustomers;

public sealed record ListCustomersQuery(
    Guid TenantId,
    string? Search = null,
    int Page = 1,
    int PageSize = 20) : IQuery<IReadOnlyList<CustomerResponse>>;
