using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.GetMenuItem;

public sealed record GetMenuItemQuery(Guid MenuItemId, Guid BranchId) : IQuery<MenuItemResponse>;
