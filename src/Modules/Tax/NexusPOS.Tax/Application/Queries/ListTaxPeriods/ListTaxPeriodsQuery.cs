using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Queries.ListTaxPeriods;

public sealed record ListTaxPeriodsQuery(Guid TenantId) : IQuery<List<TaxPeriodResponse>>;
