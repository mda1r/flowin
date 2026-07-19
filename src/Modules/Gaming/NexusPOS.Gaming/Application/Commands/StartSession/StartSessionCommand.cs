using NexusPOS.Gaming.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Commands.StartSession;

public sealed record StartSessionCommand(
    Guid StationId,
    Guid BranchId,
    string PlayerName,
    int DurationMinutes,
    decimal RatePerHour) : ICommand<GameStationResponse>;
