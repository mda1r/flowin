using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Restaurant.Infrastructure.Persistence;

namespace NexusPOS.Restaurant.Application.Commands.CreateMenuItem;

internal sealed class CreateMenuItemCommandHandler(
    IMenuItemRepository menuItemRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<CreateMenuItemCommand, MenuItemResponse>
{
    public async Task<ErrorOr<MenuItemResponse>> Handle(
        CreateMenuItemCommand request,
        CancellationToken cancellationToken)
    {
        ErrorOr<MenuItem> menuItem = MenuItem.Create(
            request.TenantId, request.BranchId, request.Category,
            request.Name, request.Description, request.Price,
            request.Currency, request.SortOrder);

        if (menuItem.IsError)
        {
            return menuItem.Errors;
        }

        menuItemRepository.Add(menuItem.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantMapper.ToResponse(menuItem.Value);
    }
}
