using ErrorOr;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Repositories;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.IAM.Infrastructure.Persistence;

namespace NexusPOS.IAM.Application.Commands.Register;

internal sealed class RegisterCommandHandler(
    IUserRepository userRepository,
    IPasswordService passwordService,
    IamDbContext dbContext)
    : ICommandHandler<RegisterCommand, RegisterResponse>
{
    public async Task<ErrorOr<RegisterResponse>> Handle(
        RegisterCommand request,
        CancellationToken cancellationToken)
    {
        ErrorOr<Email> emailResult = Email.Create(request.Email);
        if (emailResult.IsError)
        {
            return emailResult.Errors;
        }

        Email email = emailResult.Value;

        bool emailExists = await userRepository.ExistsByEmailAsync(email, cancellationToken);
        if (emailExists)
        {
            return IamErrors.EmailAlreadyExists;
        }

        User user = User.Create(email, request.FirstName, request.LastName);
        PasswordHash passwordHash = passwordService.HashPassword(request.Password);
        user.SetPassword(passwordHash);

        userRepository.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new RegisterResponse(user.Id.Value, user.Email.Value, user.FullName);
    }
}
