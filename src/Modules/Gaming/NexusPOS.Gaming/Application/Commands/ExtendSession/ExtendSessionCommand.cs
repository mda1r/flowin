using NexusPOS.Gaming.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Commands.ExtendSession;

public sealed record ExtendSessionCommand(
    Guid SessionId,
    Guid BranchId,
    int ExtraMinutes) : ICommand<GameStationResponse>;
