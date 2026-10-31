using NexusPOS.Catalog.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Queries.ListModifierGroups;

// Active groups for the editor; IncludeInactive also returns the switched-off ones.
public sealed record ListModifierGroupsQuery(bool IncludeInactive = false) : IQuery<IReadOnlyList<ModifierGroupResponse>>;
