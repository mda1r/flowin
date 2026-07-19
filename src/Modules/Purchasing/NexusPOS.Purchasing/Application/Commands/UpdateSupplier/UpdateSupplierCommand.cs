using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.UpdateSupplier;

public sealed record UpdateSupplierCommand(
    Guid SupplierId,
    Guid TenantId,
    string Name,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null) : ICommand<SupplierResponse>;
