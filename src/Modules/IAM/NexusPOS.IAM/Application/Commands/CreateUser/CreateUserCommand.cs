using NexusPOS.IAM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.CreateUser;

public sealed record CreateUserCommand(
    Guid TenantId,
    string Email,
    string FirstName,
    string LastName,
    string Password,
    string Role) : ICommand<UserSummaryResponse>;
