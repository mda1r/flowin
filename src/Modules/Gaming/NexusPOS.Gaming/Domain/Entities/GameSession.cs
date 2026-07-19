using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Gaming.Domain.Entities;

public sealed class GameSession : Entity<Guid>
{
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid StationId { get; private set; }
    public string PlayerName { get; private set; } = string.Empty;
    public DateTime StartTime { get; private set; }
    public DateTime? EndTime { get; private set; }
    public int DurationMinutes { get; private set; }
    public decimal RatePerHour { get; private set; }
    public decimal TotalAmount { get; private set; }
    public GameSessionStatus Status { get; private set; }

    private GameSession() { }

    public static GameSession Create(
        Guid tenantId,
        Guid branchId,
        Guid stationId,
        string playerName,
        int durationMinutes,
        decimal ratePerHour)
    {
        return new GameSession
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            StationId = stationId,
            PlayerName = playerName.Trim(),
            StartTime = DateTime.UtcNow,
            DurationMinutes = durationMinutes,
            RatePerHour = ratePerHour,
            TotalAmount = 0,
            Status = GameSessionStatus.Active,
        };
    }

    public void Extend(int extraMinutes)
    {
        DurationMinutes += extraMinutes;
    }

    public decimal Complete()
    {
        EndTime = DateTime.UtcNow;
        Status = GameSessionStatus.Completed;
        double actualMinutes = (EndTime.Value - StartTime).TotalMinutes;
        TotalAmount = Math.Round((decimal)(actualMinutes / 60.0) * RatePerHour, 2);
        return TotalAmount;
    }

    public void Cancel()
    {
        EndTime = DateTime.UtcNow;
        Status = GameSessionStatus.Cancelled;
    }
}
