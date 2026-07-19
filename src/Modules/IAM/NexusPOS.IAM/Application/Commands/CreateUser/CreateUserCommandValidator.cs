using FluentValidation;

namespace NexusPOS.IAM.Application.Commands.CreateUser;

internal sealed class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    private static readonly string[] _validRoles = ["Owner", "Manager", "Cashier", "Accountant", "Staff"];

    public CreateUserCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.Role).Must(r => _validRoles.Contains(r))
            .WithMessage($"الدور يجب أن يكون أحد: {string.Join(", ", _validRoles)}");
    }
}
