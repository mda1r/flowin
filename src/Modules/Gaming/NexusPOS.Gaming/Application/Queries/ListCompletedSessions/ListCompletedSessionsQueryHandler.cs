using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Domain.ValueObjects;
using NexusPOS.Gaming.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Gaming.Application.Queries.ListCompletedSessions;

internal sealed class ListCompletedSessionsQueryHandler(GamingDbContext db)
    : IQueryHandler<ListCompletedSessionsQuery, IReadOnlyList<CompletedSessionResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<CompletedSessionResponse>>> Handle(
        ListCompletedSessionsQuery request, CancellationToken cancellationToken)
    {
        var sessions = await db.GameSessions
            .Where(s => s.BranchId == request.BranchId
                && s.Status == GameSessionStatus.Completed
                && s.EndTime >= request.From
                && s.EndTime < request.To)
            .OrderBy(s => s.EndTime)
            .Take(2000)
            .ToListAsync(cancellationToken);

        List<GameStationId> stationIds = [.. sessions.Select(s => new GameStationId(s.StationId)).Distinct()];
        Dictionary<Guid, string> names = await db.GameStations
            .Where(st => stationIds.Contains(st.Id))
            .ToDictionaryAsync(st => st.Id.Value, st => st.Name, cancellationToken);

        return sessions
            .Select(s => new CompletedSessionResponse(
                s.Id,
                s.StationId,
                names.GetValueOrDefault(s.StationId, "—"),
                s.PlayerName,
                s.StartTime,
                s.EndTime!.Value,
                (int)Math.Round((s.EndTime!.Value - s.StartTime).TotalMinutes),
                s.TotalAmount))
            .ToList();
    }
}
