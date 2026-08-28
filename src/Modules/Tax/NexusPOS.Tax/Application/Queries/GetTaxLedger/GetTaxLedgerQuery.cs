using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Queries.GetTaxLedger;

public sealed record GetTaxLedgerQuery(
    Guid PeriodId,
    Guid TenantId,
    int Page = 1,
    int PageSize = 50) : IQuery<TaxLedgerResult>;
