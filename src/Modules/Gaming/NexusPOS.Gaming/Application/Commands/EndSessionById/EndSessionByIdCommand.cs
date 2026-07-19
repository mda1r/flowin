using NexusPOS.Gaming.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Commands.EndSessionById;

public sealed record EndSessionByIdCommand(
    Guid SessionId,
    Guid BranchId) : ICommand<GameSessionBillResponse>;
