using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Queries.ListExpenseInvoices;

public sealed record ListExpenseInvoicesQuery(
    Guid TenantId,
    Guid? PeriodId = null) : IQuery<List<TaxExpenseInvoiceResponse>>;
