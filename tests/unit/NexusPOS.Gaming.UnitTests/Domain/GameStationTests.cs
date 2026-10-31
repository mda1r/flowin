using ErrorOr;
using FluentAssertions;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;
using NexusPOS.Gaming.Domain.Enums;
using NexusPOS.Gaming.Domain.Events;

namespace NexusPOS.Gaming.UnitTests.Domain;

public sealed class GameStationTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();

    private static ErrorOr<GameStation> CreateValidStation(decimal hourlyRate = 50m) =>
        GameStation.Create(_tenantId, _branchId, StationType.PC, "Station Alpha", hourlyRate, "SAR");

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithValidArgs_CreatesAvailableActiveStation()
    {
        ErrorOr<GameStation> result = CreateValidStation();

        result.IsError.Should().BeFalse();
        result.Value.Status.Should().Be(StationStatus.Available);
        result.Value.IsActive.Should().BeTrue();
        result.Value.HourlyRate.Should().Be(50m);
        result.Value.StationType.Should().Be(StationType.PC);
        result.Value.TenantId.Should().Be(_tenantId);
        result.Value.BranchId.Should().Be(_branchId);
    }

    [Fact]
    public void Create_NormalizesCurrencyToUpperCase()
    {
        ErrorOr<GameStation> result = GameStation.Create(_tenantId, _branchId, StationType.Console, "PS5", 40m, "sar");

        result.IsError.Should().BeFalse();
        result.Value.Currency.Should().Be("SAR");
    }

    [Fact]
    public void Create_ZeroHourlyRate_ReturnsInvalidHourlyRateError()
    {
        ErrorOr<GameStation> result = CreateValidStation(0m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(GamingErrors.InvalidHourlyRate);
    }

    [Fact]
    public void Create_NegativeHourlyRate_ReturnsInvalidHourlyRateError()
    {
        ErrorOr<GameStation> result = CreateValidStation(-10m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(GamingErrors.InvalidHourlyRate);
    }

    // ── StartSession ──────────────────────────────────────────────────────────

    [Fact]
    public void StartSession_FromAvailable_TransitionsToInUseAndRaisesEvent()
    {
        GameStation station = CreateValidStation().Value;

        ErrorOr<Success> result = station.StartSession();

        result.IsError.Should().BeFalse();
        station.Status.Should().Be(StationStatus.InUse);
        station.DomainEvents.Should().ContainSingle(e => e is GameSessionStartedDomainEvent);
    }

    [Fact]
    public void StartSession_FromInUse_ReturnsStationNotAvailableError()
    {
        GameStation station = CreateValidStation().Value;
        station.StartSession();

        ErrorOr<Success> result = station.StartSession();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(GamingErrors.StationNotAvailable);
    }

    [Fact]
    public void StartSession_FromMaintenance_ReturnsStationNotAvailableError()
    {
        GameStation station = CreateValidStation().Value;
        station.SetMaintenance();

        ErrorOr<Success> result = station.StartSession();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(GamingErrors.StationNotAvailable);
    }

    // ── EndSession ────────────────────────────────────────────────────────────

    [Fact]
    public void EndSession_FromInUse_TransitionsToAvailableAndRaisesEvent()
    {
        GameStation station = CreateValidStation().Value;
        station.StartSession();

        ErrorOr<Success> result = station.EndSession();

        result.IsError.Should().BeFalse();
        station.Status.Should().Be(StationStatus.Available);
        station.DomainEvents.Should().Contain(e => e is GameSessionEndedDomainEvent);
    }

    [Fact]
    public void EndSession_FromAvailable_ReturnsStationNotInUseError()
    {
        GameStation station = CreateValidStation().Value;

        ErrorOr<Success> result = station.EndSession();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(GamingErrors.StationNotInUse);
    }

    [Fact]
    public void EndSession_FromMaintenance_ReturnsStationNotInUseError()
    {
        GameStation station = CreateValidStation().Value;
        station.SetMaintenance();

        ErrorOr<Success> result = station.EndSession();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(GamingErrors.StationNotInUse);
    }

    // ── SetMaintenance ────────────────────────────────────────────────────────

    [Fact]
    public void SetMaintenance_FromAvailable_TransitionsToMaintenance()
    {
        GameStation station = CreateValidStation().Value;

        ErrorOr<Success> result = station.SetMaintenance();

        result.IsError.Should().BeFalse();
        station.Status.Should().Be(StationStatus.Maintenance);
    }

    [Fact]
    public void SetMaintenance_FromInUse_ReturnsStationInUseAndKeepsSessionRunning()
    {
        GameStation station = CreateValidStation().Value;
        station.StartSession();

        ErrorOr<Success> result = station.SetMaintenance();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(GamingErrors.StationInUse);
        station.Status.Should().Be(StationStatus.InUse);
    }

    [Fact]
    public void SetMaintenance_WhenAlreadyInMaintenance_Succeeds()
    {
        GameStation station = CreateValidStation().Value;
        station.SetMaintenance();

        ErrorOr<Success> result = station.SetMaintenance();

        result.IsError.Should().BeFalse();
        station.Status.Should().Be(StationStatus.Maintenance);
    }

    // ── ReturnToService ───────────────────────────────────────────────────────

    [Fact]
    public void ReturnToService_FromMaintenance_MakesStationAvailableAndStartable()
    {
        GameStation station = CreateValidStation().Value;
        station.SetMaintenance();

        ErrorOr<Success> result = station.ReturnToService();

        result.IsError.Should().BeFalse();
        station.Status.Should().Be(StationStatus.Available);
        station.StartSession().IsError.Should().BeFalse();
    }

    [Fact]
    public void ReturnToService_WithStrandedActiveSession_GoesBackToInUseSoItCanBeEnded()
    {
        GameStation station = CreateValidStation().Value;
        station.SetMaintenance();

        ErrorOr<Success> result = station.ReturnToService(hasActiveSession: true);

        result.IsError.Should().BeFalse();
        station.Status.Should().Be(StationStatus.InUse);
        station.EndSession().IsError.Should().BeFalse();
    }

    [Fact]
    public void ReturnToService_WhenNotInMaintenance_ReturnsStationNotInMaintenance()
    {
        GameStation station = CreateValidStation().Value;

        ErrorOr<Success> result = station.ReturnToService();

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(GamingErrors.StationNotInMaintenance);
        station.Status.Should().Be(StationStatus.Available);
    }

    // ── ResolveSessionRate ────────────────────────────────────────────────────

    [Fact]
    public void ResolveSessionRate_NoRateSent_UsesStationRate()
    {
        GameStation station = CreateValidStation(50m).Value;

        station.ResolveSessionRate(null, canOverrideRate: false).Value.Should().Be(50m);
    }

    [Fact]
    public void ResolveSessionRate_CashierSendsStationRate_IsAccepted()
    {
        GameStation station = CreateValidStation(50m).Value;

        station.ResolveSessionRate(50m, canOverrideRate: false).Value.Should().Be(50m);
    }

    [Fact]
    public void ResolveSessionRate_CashierSendsOtherRate_IsRejected()
    {
        GameStation station = CreateValidStation(50m).Value;

        ErrorOr<decimal> result = station.ResolveSessionRate(0.01m, canOverrideRate: false);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(GamingErrors.RateOverrideNotAllowed);
    }

    [Fact]
    public void ResolveSessionRate_ManagerOverride_UsesRequestedRate()
    {
        GameStation station = CreateValidStation(50m).Value;

        station.ResolveSessionRate(30m, canOverrideRate: true).Value.Should().Be(30m);
    }

    [Fact]
    public void ResolveSessionRate_ManagerZeroRate_IsInvalid()
    {
        GameStation station = CreateValidStation(50m).Value;

        ErrorOr<decimal> result = station.ResolveSessionRate(0m, canOverrideRate: true);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(GamingErrors.InvalidHourlyRate);
    }

    // ── Deactivate ────────────────────────────────────────────────────────────

    [Fact]
    public void Deactivate_ActiveStation_SetsIsActiveToFalse()
    {
        GameStation station = CreateValidStation().Value;

        station.Deactivate();

        station.IsActive.Should().BeFalse();
    }
}
