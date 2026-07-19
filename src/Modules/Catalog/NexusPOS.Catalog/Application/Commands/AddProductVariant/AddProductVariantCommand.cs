using NexusPOS.Catalog.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.AddProductVariant;

public sealed record AddProductVariantCommand(
    Guid ProductId,
    string Sku,
    string Name,
    decimal CostPrice,
    decimal SalePrice,
    string Currency,
    string? Barcode = null,
    DateTime? ExpiryDate = null) : ICommand<ProductVariantResponse>;
