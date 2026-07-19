using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CreateMenuItem;

public sealed record CreateMenuItemCommand(
    Guid TenantId,
    Guid BranchId,
    MenuCategory Category,
    string Name,
    string Description,
    decimal Price,
    string Currency,
    int SortOrder) : ICommand<MenuItemResponse>;
