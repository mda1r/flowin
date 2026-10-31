using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Commands.CreateStation;

public sealed record CreateStationCommand(
    Guid TenantId,
    Guid BranchId,
    StationType StationType,
    string Name,
    decimal HourlyRate,
    string Currency) : ICommand<GameStationResponse>;
