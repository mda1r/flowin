using NexusPOS.Catalog.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.UpdateVariant;

public sealed record UpdateVariantCommand(
    Guid ProductId,
    Guid VariantId,
    string Name,
    decimal CostPrice,
    decimal SalePrice,
    string Currency,
    string? Barcode = null) : ICommand<ProductVariantResponse>;
