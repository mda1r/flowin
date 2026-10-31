using NexusPOS.Catalog.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.GetProductByBarcode;

// The till's scanner lookup: the product whose active variant has exactly this barcode or SKU.
public sealed record GetProductByBarcodeQuery(string Code) : IQuery<ProductResponse>;
