using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Commands.RecordExpenseInvoice;

public sealed record RecordExpenseInvoiceCommand(
    Guid TenantId,
    Guid? PeriodId,
    string SupplierName,
    string? SupplierVatNumber,
    string InvoiceNumber,
    DateOnly InvoiceDate,
    decimal BaseAmount,
    decimal TaxAmount,
    decimal TaxRate,
    string Currency,
    string? Notes) : ICommand<TaxExpenseInvoiceResponse>;
