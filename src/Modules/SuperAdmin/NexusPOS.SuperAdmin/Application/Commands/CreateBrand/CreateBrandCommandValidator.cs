using FluentValidation;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateBrand;

internal sealed class CreateBrandCommandValidator : AbstractValidator<CreateBrandCommand>
{
    public CreateBrandCommandValidator()
    {
        RuleFor(x => x.NameAr).NotEmpty().MaximumLength(256);
        RuleFor(x => x.NameEn).NotEmpty().MaximumLength(256);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(64)
            .Matches("^[A-Z0-9_-]+$").WithMessage("Brand code must be uppercase alphanumeric");
    }
}
