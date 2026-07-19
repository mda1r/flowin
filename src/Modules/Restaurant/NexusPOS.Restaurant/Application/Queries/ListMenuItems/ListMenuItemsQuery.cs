using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListMenuItems;

public sealed record ListMenuItemsQuery(
    Guid BranchId,
    MenuCategory? Category = null,
    bool IncludeUnavailable = false,
    int Page = 1,
    int PageSize = 20) : IQuery<IReadOnlyList<MenuItemResponse>>;
