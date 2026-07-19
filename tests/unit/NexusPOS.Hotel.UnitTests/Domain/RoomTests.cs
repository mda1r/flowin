using ErrorOr;
using FluentAssertions;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.Events;

namespace NexusPOS.Hotel.UnitTests.Domain;

public sealed class RoomTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();

    private static ErrorOr<Room> CreateValidRoom(
        decimal nightlyRate = 250m,
        int capacity = 2) =>
        Room.Create(_tenantId, _branchId, RoomType.Standard, "101", 1, capacity, nightlyRate, "SAR");

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithValidArgs_CreatesAvailableActiveRoom()
    {
        ErrorOr<Room> result = CreateValidRoom();

        result.IsError.Should().BeFalse();
        result.Value.Status.Should().Be(RoomStatus.Available);
        result.Value.IsActive.Should().BeTrue();
        result.Value.NightlyRate.Should().Be(250m);
        result.Value.Currency.Should().Be("SAR");
        result.Value.RoomType.Should().Be(RoomType.Standard);
        result.Value.RoomNumber.Should().Be("101");
        result.Value.Capacity.Should().Be(2);
    }

    [Fact]
    public void Create_NormalizesLowercaseCurrency()
    {
        ErrorOr<Room> result = Room.Create(_tenantId, _branchId, RoomType.Deluxe, "201", 2, 2, 400m, "usd");

        result.IsError.Should().BeFalse();
        result.Value.Currency.Should().Be("USD");
    }

    [Fact]
    public void Create_RaisesRoomCreatedDomainEvent()
    {
        ErrorOr<Room> result = CreateValidRoom();

        result.IsError.Should().BeFalse();
        result.Value.DomainEvents.Should().ContainSingle(e => e is RoomCreatedDomainEvent);
    }

    [Fact]
    public void Create_ZeroNightlyRate_ReturnsError()
    {
        ErrorOr<Room> result = CreateValidRoom(nightlyRate: 0m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(HotelErrors.InvalidNightlyRate);
    }

    [Fact]
    public void Create_NegativeNightlyRate_ReturnsError()
    {
        ErrorOr<Room> result = CreateValidRoom(nightlyRate: -100m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(HotelErrors.InvalidNightlyRate);
    }

    [Fact]
    public void Create_ZeroCapacity_ReturnsError()
    {
        ErrorOr<Room> result = CreateValidRoom(capacity: 0);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(HotelErrors.InvalidCapacity);
    }

    [Fact]
    public void Create_NegativeCapacity_ReturnsError()
    {
        ErrorOr<Room> result = CreateValidRoom(capacity: -1);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(HotelErrors.InvalidCapacity);
    }

    // ── SetStatus ─────────────────────────────────────────────────────────────

    [Fact]
    public void SetStatus_AvailableToOccupied_Succeeds()
    {
        Room room = CreateValidRoom().Value;

        ErrorOr<Success> result = room.SetStatus(RoomStatus.Occupied);

        result.IsError.Should().BeFalse();
        room.Status.Should().Be(RoomStatus.Occupied);
    }

    [Fact]
    public void SetStatus_OccupiedToMaintenance_Succeeds()
    {
        Room room = CreateValidRoom().Value;
        room.SetStatus(RoomStatus.Occupied);

        ErrorOr<Success> result = room.SetStatus(RoomStatus.Maintenance);

        result.IsError.Should().BeFalse();
        room.Status.Should().Be(RoomStatus.Maintenance);
    }

    [Fact]
    public void SetStatus_MaintenanceToAvailable_Succeeds()
    {
        Room room = CreateValidRoom().Value;
        room.SetStatus(RoomStatus.Occupied);
        room.SetStatus(RoomStatus.Maintenance);

        ErrorOr<Success> result = room.SetStatus(RoomStatus.Available);

        result.IsError.Should().BeFalse();
        room.Status.Should().Be(RoomStatus.Available);
    }

    [Fact]
    public void SetStatus_SameStatus_ReturnsError()
    {
        Room room = CreateValidRoom().Value;

        ErrorOr<Success> result = room.SetStatus(RoomStatus.Available);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(HotelErrors.RoomStatusUnchanged);
    }

    [Fact]
    public void SetStatus_OccupiedToAvailable_ReturnsError()
    {
        Room room = CreateValidRoom().Value;
        room.SetStatus(RoomStatus.Occupied);

        ErrorOr<Success> result = room.SetStatus(RoomStatus.Available);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(HotelErrors.InvalidStatusTransition);
    }

    // ── Deactivate ────────────────────────────────────────────────────────────

    [Fact]
    public void Deactivate_ActiveRoom_SetsIsActiveToFalse()
    {
        Room room = CreateValidRoom().Value;

        room.Deactivate();

        room.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Deactivate_UpdatesUpdatedAt()
    {
        Room room = CreateValidRoom().Value;
        DateTime before = room.UpdatedAt;

        room.Deactivate();

        room.UpdatedAt.Should().BeOnOrAfter(before);
    }
}
