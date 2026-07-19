using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.UpdateMenuItem;

public sealed record UpdateMenuItemCommand(
    Guid MenuItemId,
    Guid BranchId,
    MenuCategory Category,
    string Name,
    string Description,
    decimal Price,
    int SortOrder) : ICommand<MenuItemResponse>;
