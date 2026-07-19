using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.DeactivateSupplier;

public sealed record DeactivateSupplierCommand(Guid SupplierId, Guid TenantId) : ICommand<SupplierResponse>;
