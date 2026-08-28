using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Queries.GetTaxAnomalies;

public sealed record GetTaxAnomaliesQuery(
    Guid PeriodId,
    Guid TenantId,
    bool IncludeResolved = false) : IQuery<List<TaxAnomalyResponse>>;
