using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.DeleteUser;

public sealed record DeleteUserCommand(Guid UserId, Guid CurrentUserId, Guid TenantId) : ICommand;
