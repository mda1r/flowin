using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.Register;

public sealed record RegisterCommand(
    string Email,
    string Password,
    string FirstName,
    string LastName) : ICommand<RegisterResponse>;

public sealed record RegisterResponse(
    Guid UserId,
    string Email,
    string FullName);
