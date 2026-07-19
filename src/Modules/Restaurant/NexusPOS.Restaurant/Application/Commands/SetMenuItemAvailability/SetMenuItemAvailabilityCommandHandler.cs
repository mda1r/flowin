using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Restaurant.Infrastructure.Persistence;

namespace NexusPOS.Restaurant.Application.Commands.SetMenuItemAvailability;

internal sealed class SetMenuItemAvailabilityCommandHandler(
    IMenuItemRepository menuItemRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<SetMenuItemAvailabilityCommand, MenuItemResponse>
{
    public async Task<ErrorOr<MenuItemResponse>> Handle(
        SetMenuItemAvailabilityCommand request,
        CancellationToken cancellationToken)
    {
        MenuItem? menuItem = await menuItemRepository.FindByIdAsync(
            new MenuItemId(request.MenuItemId), cancellationToken);

        if (menuItem is null || menuItem.BranchId != request.BranchId)
        {
            return RestaurantErrors.MenuItemNotFound;
        }

        menuItem.SetAvailability(request.IsAvailable);
        menuItemRepository.Update(menuItem);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantMapper.ToResponse(menuItem);
    }
}
