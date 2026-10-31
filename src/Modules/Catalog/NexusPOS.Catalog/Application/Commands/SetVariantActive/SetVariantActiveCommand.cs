using NexusPOS.Catalog.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.SetVariantActive;

public sealed record SetVariantActiveCommand(
    Guid ProductId,
    Guid VariantId,
    bool IsActive) : ICommand<ProductVariantResponse>;
