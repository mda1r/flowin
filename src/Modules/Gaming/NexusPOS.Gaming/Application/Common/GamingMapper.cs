using NexusPOS.Gaming.Domain.Entities;

namespace NexusPOS.Gaming.Application.Common;

internal static class GamingMapper
{
    internal static GameStationResponse ToResponse(GameStation station, GameSession? activeSession = null)
    {
        GameSessionSummary? sessionSummary = activeSession is null
            ? null
            : new GameSessionSummary(
                activeSession.Id,
                activeSession.PlayerName,
                activeSession.StartTime,
                activeSession.DurationMinutes,
                activeSession.RatePerHour);

        return new GameStationResponse(
            station.Id.Value,
            station.TenantId,
            station.BranchId,
            station.StationType,
            station.Name,
            station.HourlyRate,
            station.Currency,
            station.Status,
            station.IsActive,
            station.CreatedAt,
            station.UpdatedAt,
            sessionSummary);
    }

    internal static GameSessionResponse ToSessionResponse(GameSession session) => new(
        session.Id,
        session.StationId,
        session.TenantId,
        session.BranchId,
        session.PlayerName,
        session.StartTime,
        session.DurationMinutes,
        session.RatePerHour,
        session.Status);

    internal static GameSessionBillResponse ToBillResponse(GameSession session, GameStation station)
    {
        double actualMinutes = session.EndTime.HasValue
            ? (session.EndTime.Value - session.StartTime).TotalMinutes
            : 0;

        return new GameSessionBillResponse(
            session.Id,
            station.Id.Value,
            station.Name,
            station.StationType.ToString(),
            session.PlayerName,
            session.StartTime,
            session.EndTime ?? DateTime.UtcNow,
            session.DurationMinutes,
            Math.Round(actualMinutes, 1),
            session.RatePerHour,
            session.TotalAmount,
            station.Currency);
    }
}
