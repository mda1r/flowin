using FluentValidation;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CancelRestaurantOrder;

public sealed record CancelRestaurantOrderCommand(Guid OrderId, Guid BranchId, string Reason) : ICommand<RestaurantOrderResponse>;

internal sealed class CancelRestaurantOrderCommandValidator : AbstractValidator<CancelRestaurantOrderCommand>
{
    public CancelRestaurantOrderCommandValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(256);
    }
}
