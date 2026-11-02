using NexusPOS.Catalog.Application.Commands.CreateModifierGroup;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.UpdateModifierGroup;

// Options replaces the group's list: send an existing option's id to keep it, leave it out to remove it.
public sealed record UpdateModifierGroupCommand(
    Guid GroupId,
    string Name,
    bool IsRequired,
    int MinSelect,
    int MaxSelect,
    int SortOrder,
    IReadOnlyList<ModifierOptionDraft> Options,
    string? NameEn = null) : ICommand<ModifierGroupResponse>, IModifierGroupInput;
