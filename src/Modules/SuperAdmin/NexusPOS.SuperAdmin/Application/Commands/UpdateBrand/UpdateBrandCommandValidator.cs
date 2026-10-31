using FluentValidation;
using NexusPOS.Organization.Domain.Entities;

namespace NexusPOS.SuperAdmin.Application.Commands.UpdateBrand;

internal sealed class UpdateBrandCommandValidator : AbstractValidator<UpdateBrandCommand>
{
    public UpdateBrandCommandValidator()
    {
        RuleFor(x => x.BrandId).NotEmpty();
        RuleFor(x => x.NameAr).NotEmpty().MaximumLength(256);
        RuleFor(x => x.NameEn).NotEmpty().MaximumLength(256);
        string[] validStatuses = [BrandStatus.Active, BrandStatus.Suspended, BrandStatus.Archived];
        RuleFor(x => x.Status)
            .Must(s => s is null || validStatuses.Contains(s))
            .WithMessage("Status must be one of: active, suspended, archived");
    }
}
