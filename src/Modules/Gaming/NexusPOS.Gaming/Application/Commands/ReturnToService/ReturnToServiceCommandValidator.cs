using FluentValidation;

namespace NexusPOS.Gaming.Application.Commands.ReturnToService;

internal sealed class ReturnToServiceCommandValidator : AbstractValidator<ReturnToServiceCommand>
{
    public ReturnToServiceCommandValidator()
    {
        RuleFor(x => x.StationId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
    }
}
