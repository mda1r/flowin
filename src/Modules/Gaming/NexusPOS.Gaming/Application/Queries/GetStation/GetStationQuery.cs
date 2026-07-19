using NexusPOS.Gaming.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Queries.GetStation;

public sealed record GetStationQuery(Guid StationId, Guid BranchId) : IQuery<GameStationResponse>;
