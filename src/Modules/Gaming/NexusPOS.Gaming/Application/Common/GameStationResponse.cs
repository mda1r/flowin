using NexusPOS.Gaming.Domain.Enums;

namespace NexusPOS.Gaming.Application.Common;

public sealed record GameStationResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    StationType Type,
    string Name,
    decimal HourlyRate,
    string Currency,
    StationStatus Status,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    GameSessionSummary? ActiveSession = null);

public sealed record GameSessionSummary(
    Guid SessionId,
    string PlayerName,
    DateTime StartTime,
    int DurationMinutes,
    decimal RatePerHour);
