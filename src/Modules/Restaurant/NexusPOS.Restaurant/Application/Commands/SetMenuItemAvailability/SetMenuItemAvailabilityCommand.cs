using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.SetMenuItemAvailability;

public sealed record SetMenuItemAvailabilityCommand(
    Guid MenuItemId,
    Guid BranchId,
    bool IsAvailable) : ICommand<MenuItemResponse>;
