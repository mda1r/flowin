using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.CreateSupplier;

public sealed record CreateSupplierCommand(
    Guid TenantId,
    string Name,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null) : ICommand<SupplierResponse>;
