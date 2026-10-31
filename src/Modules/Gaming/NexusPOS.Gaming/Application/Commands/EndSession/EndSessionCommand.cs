using NexusPOS.Gaming.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Commands.EndSession;

public sealed record EndSessionCommand(Guid StationId, Guid BranchId) : ICommand<GameStationResponse>;
