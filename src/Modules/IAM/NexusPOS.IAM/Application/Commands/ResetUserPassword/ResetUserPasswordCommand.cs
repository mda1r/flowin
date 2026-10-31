using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.ResetUserPassword;

public sealed record ResetUserPasswordCommand(
    Guid TenantId,
    Guid UserId,
    Guid CurrentUserId,
    IReadOnlyCollection<string> CallerRoles,
    string NewPassword) : ICommand;
