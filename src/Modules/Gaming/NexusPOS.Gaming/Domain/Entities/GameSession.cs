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
    public string? PaymentMethod { get; private set; }

    // Snapshot of the package at start, so later edits to the package never change a running session's bill.
    public Guid? PackageId { get; private set; }
    public string? PackageName { get; private set; }
    public decimal? PackagePrice { get; private set; }
    public int? PackageMinutes { get; private set; }
    public DateTime? PaidAt { get; private set; }

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

    public static GameSession CreateWithPackage(
        Guid tenantId, Guid branchId, Guid stationId, string playerName, GamingPackage package, decimal ratePerHour)
    {
        GameSession session = Create(tenantId, branchId, stationId, playerName, package.DurationMinutes, ratePerHour);
        session.PackageId = package.Id;
        session.PackageName = package.Name;
        session.PackagePrice = package.Price;
        session.PackageMinutes = package.DurationMinutes;
        return session;
    }

    public void Extend(int extraMinutes)
    {
        DurationMinutes += extraMinutes;
    }

    public decimal Complete(DateTime? endTime = null)
    {
        EndTime = endTime ?? DateTime.UtcNow;
        Status = GameSessionStatus.Completed;
        decimal actualMinutes = (decimal)(EndTime.Value - StartTime).TotalMinutes;
        TotalAmount = PackagePrice is decimal price
            ? price + OvertimeCharge(actualMinutes)
            : Math.Round(actualMinutes / 60m * RatePerHour, 2);
        return TotalAmount;
    }

    // Time played beyond the package, billed at the station's hourly rate; ending early still costs the package price.
    public decimal OvertimeMinutes =>
        PackageMinutes is int included && EndTime.HasValue
            ? Math.Max(0m, Math.Round((decimal)(EndTime.Value - StartTime).TotalMinutes - included, 2))
            : 0m;

    private decimal OvertimeCharge(decimal actualMinutes) =>
        PackageMinutes is int included && actualMinutes > included
            ? Math.Round((actualMinutes - included) / 60m * RatePerHour, 2)
            : 0m;

    public ErrorOr.ErrorOr<ErrorOr.Success> MarkPaid(string paymentMethod)
    {
        if (Status != GameSessionStatus.Completed)
        {
            return GamingErrors.SessionNotCompleted;
        }

        if (PaidAt.HasValue)
        {
            return GamingErrors.SessionAlreadyPaid;
        }

        PaymentMethod = paymentMethod;
        PaidAt = DateTime.UtcNow;
        return ErrorOr.Result.Success;
    }

    public void Cancel()
    {
        EndTime = DateTime.UtcNow;
        Status = GameSessionStatus.Cancelled;
    }
}
