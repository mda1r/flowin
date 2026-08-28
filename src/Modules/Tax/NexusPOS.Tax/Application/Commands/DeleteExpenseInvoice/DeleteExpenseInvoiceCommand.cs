using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Tax.Application.Commands.DeleteExpenseInvoice;

public sealed record DeleteExpenseInvoiceCommand(Guid InvoiceId, Guid TenantId) : ICommand<bool>;
