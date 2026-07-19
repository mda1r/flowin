using NexusPOS.Gaming.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Commands.SetMaintenance;

public sealed record SetMaintenanceCommand(Guid StationId, Guid BranchId) : ICommand<GameStationResponse>;
