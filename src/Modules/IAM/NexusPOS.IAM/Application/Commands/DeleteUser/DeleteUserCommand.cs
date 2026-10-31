using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.DeleteUser;

/// <summary>
/// Removes a user from the tenant. By default this only deactivates the account so shifts,
/// orders and activity logs keep pointing at a real user; <paramref name="Permanent"/> hard-deletes
/// and is allowed only for accounts that never signed in.
/// </summary>
public sealed record DeleteUserCommand(
    Guid UserId,
    Guid CurrentUserId,
    Guid TenantId,
    IReadOnlyCollection<string> CallerRoles,
    bool Permanent = false) : ICommand;
