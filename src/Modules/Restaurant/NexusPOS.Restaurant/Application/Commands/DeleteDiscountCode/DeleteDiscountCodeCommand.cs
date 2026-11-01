using ErrorOr;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.DeleteDiscountCode;

// Sales made with the code keep its text on the invoice, so removing it loses no history.
public sealed record DeleteDiscountCodeCommand(Guid TenantId, Guid Id) : ICommand<Deleted>;
