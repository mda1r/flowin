using NexusPOS.Gaming.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Commands.ReturnToService;

public sealed record ReturnToServiceCommand(Guid StationId, Guid BranchId) : ICommand<GameStationResponse>;
