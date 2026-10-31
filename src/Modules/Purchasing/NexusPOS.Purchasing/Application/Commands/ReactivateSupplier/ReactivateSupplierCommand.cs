using NexusPOS.Purchasing.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Purchasing.Application.Commands.ReactivateSupplier;

public sealed record ReactivateSupplierCommand(Guid SupplierId, Guid TenantId) : ICommand<SupplierResponse>;
