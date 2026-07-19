using NexusPOS.Gaming.Application.Common;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Queries.ListStations;

public sealed record ListStationsQuery(
    Guid BranchId,
    StationType? StationType = null,
    StationStatus? Status = null,
    int Page = 1,
    int PageSize = 20) : IQuery<IReadOnlyList<GameStationResponse>>;
