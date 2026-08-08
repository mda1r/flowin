using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.LogActivity;

public sealed record LogActivityCommand(
    Guid? BranchId,
    Guid UserId,
    string UserName,
    string? UserEmail,
    string Category,
    string Action,
    string? Details,
    DateTime OccurredAt) : ICommand<ActivityLogResponse>;
