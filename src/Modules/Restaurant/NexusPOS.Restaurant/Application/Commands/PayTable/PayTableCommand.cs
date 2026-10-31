using FluentValidation;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.PayTable;

// Settles every open order of a table in one go. OrderIds are the orders the cashier saw on the bill;
// if another round reached the table meanwhile, the payment is refused so nobody is under-charged.
public sealed record PayTableCommand(
    Guid BranchId,
    int TableNumber,
    IReadOnlyList<Guid> OrderIds,
    string PaymentMethod,
    decimal AmountTendered) : ICommand<IReadOnlyList<RestaurantOrderResponse>>;

internal sealed class PayTableCommandValidator : AbstractValidator<PayTableCommand>
{
    public PayTableCommandValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.TableNumber).GreaterThan(0);
        RuleFor(x => x.OrderIds).NotEmpty();
        RuleFor(x => x.PaymentMethod).Must(m => m is RestaurantPayment.Cash or RestaurantPayment.Card);
        RuleFor(x => x.AmountTendered).GreaterThan(0);
    }
}
