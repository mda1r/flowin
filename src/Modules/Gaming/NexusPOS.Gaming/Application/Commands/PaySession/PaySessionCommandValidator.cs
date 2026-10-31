using FluentValidation;

namespace NexusPOS.Gaming.Application.Commands.PaySession;

internal sealed class PaySessionCommandValidator : AbstractValidator<PaySessionCommand>
{
    public PaySessionCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
        RuleFor(x => x.PaymentMethod).Must(m => m is "Cash" or "Card").WithMessage("Payment method must be Cash or Card.");
    }
}
