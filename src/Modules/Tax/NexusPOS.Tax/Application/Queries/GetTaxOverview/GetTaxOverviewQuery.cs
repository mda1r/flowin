using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Queries.GetTaxOverview;

public sealed record GetTaxOverviewQuery(Guid PeriodId, Guid TenantId) : IQuery<TaxOverviewResponse>;
