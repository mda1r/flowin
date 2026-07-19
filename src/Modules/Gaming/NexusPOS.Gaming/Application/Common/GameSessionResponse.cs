using NexusPOS.Gaming.Domain.Enums;

namespace NexusPOS.Gaming.Application.Common;

public sealed record GameSessionResponse(
    Guid Id,
    Guid StationId,
    Guid TenantId,
    Guid BranchId,
    string PlayerName,
    DateTime StartTime,
    int DurationMinutes,
    decimal RatePerHour,
    GameSessionStatus Status);

public sealed record GameSessionBillResponse(
    Guid SessionId,
    Guid StationId,
    string StationName,
    string StationType,
    string PlayerName,
    DateTime StartTime,
    DateTime EndTime,
    int PlannedDurationMinutes,
    double ActualDurationMinutes,
    decimal RatePerHour,
    decimal TotalAmount,
    string Currency);
