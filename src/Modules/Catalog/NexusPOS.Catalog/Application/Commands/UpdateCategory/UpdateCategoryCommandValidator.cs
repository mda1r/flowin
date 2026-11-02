using FluentValidation;

namespace NexusPOS.Catalog.Application.Commands.UpdateCategory;

internal sealed class UpdateCategoryCommandValidator : AbstractValidator<UpdateCategoryCommand>
{
    public UpdateCategoryCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(128);
    }
}
