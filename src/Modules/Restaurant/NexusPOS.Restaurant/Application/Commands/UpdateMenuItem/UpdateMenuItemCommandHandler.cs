using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Restaurant.Infrastructure.Persistence;

namespace NexusPOS.Restaurant.Application.Commands.UpdateMenuItem;

internal sealed class UpdateMenuItemCommandHandler(
    IMenuItemRepository menuItemRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<UpdateMenuItemCommand, MenuItemResponse>
{
    public async Task<ErrorOr<MenuItemResponse>> Handle(
        UpdateMenuItemCommand request,
        CancellationToken cancellationToken)
    {
        MenuItem? menuItem = await menuItemRepository.FindByIdAsync(
            new MenuItemId(request.MenuItemId), cancellationToken);

        if (menuItem is null || menuItem.BranchId != request.BranchId)
        {
            return RestaurantErrors.MenuItemNotFound;
        }

        ErrorOr<Success> result = menuItem.Update(
            request.Category, request.Name, request.Description, request.Price, request.SortOrder);

        if (result.IsError)
        {
            return result.Errors;
        }

        menuItemRepository.Update(menuItem);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantMapper.ToResponse(menuItem);
    }
}
