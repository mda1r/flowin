using FluentValidation;

namespace NexusPOS.IAM.Application.Commands.SetUserPages;

internal sealed class SetUserPagesCommandValidator : AbstractValidator<SetUserPagesCommand>
{
    public const int MaxPages = 64;

    public SetUserPagesCommandValidator()
    {
        RuleFor(x => x.Pages!.Count)
            .LessThanOrEqualTo(MaxPages)
            .When(x => x.Pages is not null);

        // Route paths only ("/pos", "/settings/zatca"): nothing else is stored or sent back to the app.
        RuleForEach(x => x.Pages)
            .NotEmpty()
            .MaximumLength(64)
            .Matches("^/[a-z0-9/-]*$")
            .WithMessage("مسار صفحة غير صالح");
    }
}
