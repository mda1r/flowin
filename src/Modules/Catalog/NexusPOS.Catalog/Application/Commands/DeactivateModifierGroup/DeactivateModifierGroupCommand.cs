using ErrorOr;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.DeactivateModifierGroup;

public sealed record DeactivateModifierGroupCommand(Guid GroupId) : ICommand<Success>;
