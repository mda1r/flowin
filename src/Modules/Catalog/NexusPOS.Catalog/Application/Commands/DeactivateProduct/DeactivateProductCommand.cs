using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.DeactivateProduct;

public sealed record DeactivateProductCommand(Guid ProductId) : ICommand;
