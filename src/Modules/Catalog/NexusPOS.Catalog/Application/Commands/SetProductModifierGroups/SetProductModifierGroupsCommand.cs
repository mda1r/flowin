using ErrorOr;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.SetProductModifierGroups;

// GroupIds replaces the product's groups, in the order the till should ask them; an empty list detaches all.
public sealed record SetProductModifierGroupsCommand(Guid ProductId, IReadOnlyList<Guid> GroupIds) : ICommand<Success>;
