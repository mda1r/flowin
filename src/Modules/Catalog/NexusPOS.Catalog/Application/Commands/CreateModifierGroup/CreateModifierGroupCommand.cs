using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.CreateModifierGroup;

// Option prices are net of VAT.
public sealed record CreateModifierGroupCommand(
    string Name,
    bool IsRequired,
    int MinSelect,
    int MaxSelect,
    int SortOrder,
    IReadOnlyList<ModifierOptionDraft> Options) : ICommand<ModifierGroupResponse>, IModifierGroupInput;
