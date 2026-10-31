using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.Hotel.Application.Commands.ActivateRentalContract;
using NexusPOS.Hotel.Application.Commands.CancelRentalContract;
using NexusPOS.Hotel.Application.Commands.CancelReservation;
using NexusPOS.Hotel.Application.Commands.CheckIn;
using NexusPOS.Hotel.Application.Commands.CheckOut;
using NexusPOS.Hotel.Application.Commands.CreateRentalContract;
using NexusPOS.Hotel.Application.Commands.DeactivateRoom;
using NexusPOS.Hotel.Application.Commands.ExtendReservation;
using NexusPOS.Hotel.Application.Commands.SignRentalContract;
using NexusPOS.Hotel.Application.Commands.UpdateRentalContract;
using NexusPOS.Hotel.Application.Commands.UpdateRoomStatus;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Application.Queries.GetRentalContract;
using NexusPOS.Hotel.Application.Queries.ListHotelRooms;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.Hotel.Infrastructure.Persistence.Repositories;

namespace NexusPOS.Hotel.UnitTests.Application;

public sealed class HotelHandlerTests : IDisposable
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();

    private readonly HotelDbContext _db = new(
        new DbContextOptionsBuilder<HotelDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options,
        new Mock<IPublisher>().Object);

    public void Dispose() => _db.Dispose();

    private RoomRepository Rooms => new(_db);
    private ReservationRepository Reservations => new(_db);
    private RentalContractRepository Contracts => new(_db);

    private async Task<Room> AddRoomAsync(string number = "101")
    {
        Room room = Room.Create(_tenantId, _branchId, RoomType.Standard, number, 1, 2, 200m, "SAR").Value;
        _db.Rooms.Add(room);
        await _db.SaveChangesAsync();
        return room;
    }

    private async Task<ErrorOr<ReservationResponse>> CheckInAsync(Room room, int nights = 3)
    {
        DateTime checkIn = DateTime.UtcNow.Date;
        CheckInCommandHandler handler = new(Rooms, Reservations, _db);
        return await handler.Handle(
            new CheckInCommand(_tenantId, _branchId, room.Id.Value, "Guest", "123", "0500000000",
                checkIn, checkIn.AddDays(nights), 200m),
            CancellationToken.None);
    }

    // ── Room status rules ─────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateRoomStatus_RoomWithActiveReservation_IsBlocked()
    {
        Room room = await AddRoomAsync();
        (await CheckInAsync(room)).IsError.Should().BeFalse();

        ErrorOr<RoomResponse> result = await new UpdateRoomStatusCommandHandler(Rooms, Reservations, _db)
            .Handle(new UpdateRoomStatusCommand(room.Id.Value, _branchId, RoomStatus.Maintenance), CancellationToken.None);

        result.FirstError.Should().Be(HotelErrors.RoomHasActiveReservation);
        (await _db.Rooms.SingleAsync()).Status.Should().Be(RoomStatus.Occupied);
    }

    [Fact]
    public async Task UpdateRoomStatus_ToOccupied_IsRejected()
    {
        Room room = await AddRoomAsync();

        ErrorOr<RoomResponse> result = await new UpdateRoomStatusCommandHandler(Rooms, Reservations, _db)
            .Handle(new UpdateRoomStatusCommand(room.Id.Value, _branchId, RoomStatus.Occupied), CancellationToken.None);

        result.FirstError.Should().Be(HotelErrors.RoomOccupiedOnlyByCheckIn);
    }

    [Fact]
    public async Task UpdateRoomStatus_FreeRoom_ToMaintenance_Succeeds()
    {
        Room room = await AddRoomAsync();

        ErrorOr<RoomResponse> result = await new UpdateRoomStatusCommandHandler(Rooms, Reservations, _db)
            .Handle(new UpdateRoomStatusCommand(room.Id.Value, _branchId, RoomStatus.Maintenance), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Status.Should().Be(RoomStatus.Maintenance);
    }

    [Fact]
    public async Task DeactivateRoom_WithActiveReservation_IsBlocked()
    {
        Room room = await AddRoomAsync();
        await CheckInAsync(room);

        ErrorOr<RoomResponse> result = await new DeactivateRoomCommandHandler(Rooms, Reservations, _db)
            .Handle(new DeactivateRoomCommand(room.Id.Value, _branchId), CancellationToken.None);

        result.FirstError.Should().Be(HotelErrors.RoomHasActiveReservation);
        (await _db.Rooms.SingleAsync()).IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task CheckIn_RoomThatAlreadyHasActiveReservation_IsRejected()
    {
        Room room = await AddRoomAsync();
        await CheckInAsync(room);

        // Simulate legacy data where the room was freed while the stay stayed active.
        room.ReleaseRoom();
        await _db.SaveChangesAsync();

        ErrorOr<ReservationResponse> second = await CheckInAsync(room);

        second.FirstError.Should().Be(HotelErrors.RoomAlreadyOccupied);
        (await _db.Reservations.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task ListHotelRooms_DuplicateActiveReservations_DoesNotThrowAndHidesInactiveRooms()
    {
        Room room = await AddRoomAsync("101");
        Room retired = await AddRoomAsync("102");
        retired.Deactivate();
        DateTime today = DateTime.UtcNow.Date;
        _db.Reservations.Add(Reservation.Create(_tenantId, _branchId, room.Id.Value, "A", "1", "05", today, today.AddDays(2), 200m).Value);
        _db.Reservations.Add(Reservation.Create(_tenantId, _branchId, room.Id.Value, "B", "2", "05", today, today.AddDays(5), 200m).Value);
        await _db.SaveChangesAsync();

        ErrorOr<IReadOnlyList<RoomResponse>> result = await new ListHotelRoomsQueryHandler(Rooms, Reservations)
            .Handle(new ListHotelRoomsQuery(_branchId), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Should().ContainSingle();
        result.Value[0].ActiveReservation!.GuestName.Should().Be("A");
    }

    // ── Reservations ──────────────────────────────────────────────────────────

    [Fact]
    public async Task CancelReservation_FreesRoomWithoutCleaningFlag()
    {
        Room room = await AddRoomAsync();
        ReservationResponse reservation = (await CheckInAsync(room)).Value;

        ErrorOr<ReservationResponse> result = await new CancelReservationCommandHandler(Reservations, Rooms, _db)
            .Handle(new CancelReservationCommand(reservation.Id, _branchId), CancellationToken.None);

        result.Value.Status.Should().Be(ReservationStatus.Cancelled);
        Room saved = await _db.Rooms.SingleAsync();
        saved.Status.Should().Be(RoomStatus.Available);
        saved.CleaningStatus.Should().Be(CleaningStatus.Clean);
    }

    [Fact]
    public async Task CancelReservation_OtherBranch_ReturnsNotFound()
    {
        Room room = await AddRoomAsync();
        ReservationResponse reservation = (await CheckInAsync(room)).Value;

        ErrorOr<ReservationResponse> result = await new CancelReservationCommandHandler(Reservations, Rooms, _db)
            .Handle(new CancelReservationCommand(reservation.Id, Guid.NewGuid()), CancellationToken.None);

        result.FirstError.Should().Be(HotelErrors.ReservationNotFound);
    }

    [Fact]
    public async Task ExtendReservation_RecalculatesNightsAndTotal()
    {
        Room room = await AddRoomAsync();
        ReservationResponse reservation = (await CheckInAsync(room, nights: 2)).Value;

        ErrorOr<ReservationResponse> result = await new ExtendReservationCommandHandler(Reservations, _db)
            .Handle(new ExtendReservationCommand(reservation.Id, _branchId, reservation.CheckOut.AddDays(3)), CancellationToken.None);

        result.Value.Nights.Should().Be(5);
        result.Value.TotalAmount.Should().Be(1000m);
    }

    [Fact]
    public async Task CheckOut_BeforeBookedDate_BillsNightsStayed()
    {
        Room room = await AddRoomAsync();
        ReservationResponse reservation = (await CheckInAsync(room, nights: 4)).Value;

        // Checking out on arrival day: one night, not four.
        ErrorOr<ReservationResponse> result = await new CheckOutCommandHandler(Reservations, Rooms, _db)
            .Handle(new CheckOutCommand(reservation.Id, _branchId), CancellationToken.None);

        result.Value.Status.Should().Be(ReservationStatus.CheckedOut);
        result.Value.Nights.Should().Be(1);
        result.Value.TotalAmount.Should().Be(200m);
        (await _db.Rooms.SingleAsync()).CleaningStatus.Should().Be(CleaningStatus.NeedsClean);
    }

    // ── Rental contracts ──────────────────────────────────────────────────────

    private async Task<RentalContractResponse> CreateContractAsync() =>
        (await new CreateRentalContractCommandHandler(Contracts, _db).Handle(
            new CreateRentalContractCommand(
                _branchId, _tenantId, "Renter", "123", "0500000000", "101",
                DateTime.UtcNow.Date, DateTime.UtcNow.Date.AddMonths(6), 3000m, "Landlord",
                [new CreateRentalContractClauseDto(1, "Rules", "Body")]),
            CancellationToken.None)).Value;

    [Fact]
    public async Task SignContract_Draft_Succeeds()
    {
        RentalContractResponse contract = await CreateContractAsync();

        ErrorOr<RentalContractResponse> result = await new SignRentalContractCommandHandler(Contracts, _db)
            .Handle(new SignRentalContractCommand(contract.Id, _branchId), CancellationToken.None);

        result.Value.Status.Should().Be(ContractStatus.Executed);
    }

    [Fact]
    public async Task ContractHandlers_OtherBranch_ReturnNotFound()
    {
        RentalContractResponse contract = await CreateContractAsync();
        Guid otherBranch = Guid.NewGuid();

        (await new GetRentalContractQueryHandler(Contracts)
            .Handle(new GetRentalContractQuery(contract.Id, otherBranch), CancellationToken.None))
            .FirstError.Should().Be(HotelErrors.ContractNotFound);
        (await new SignRentalContractCommandHandler(Contracts, _db)
            .Handle(new SignRentalContractCommand(contract.Id, otherBranch), CancellationToken.None))
            .FirstError.Should().Be(HotelErrors.ContractNotFound);
        (await new ActivateRentalContractCommandHandler(Contracts, _db)
            .Handle(new ActivateRentalContractCommand(contract.Id, otherBranch), CancellationToken.None))
            .FirstError.Should().Be(HotelErrors.ContractNotFound);
        (await new CancelRentalContractCommandHandler(Contracts, _db)
            .Handle(new CancelRentalContractCommand(contract.Id, otherBranch), CancellationToken.None))
            .FirstError.Should().Be(HotelErrors.ContractNotFound);
    }

    [Fact]
    public async Task UpdateContract_Signed_IsRejected()
    {
        RentalContractResponse contract = await CreateContractAsync();
        await new SignRentalContractCommandHandler(Contracts, _db)
            .Handle(new SignRentalContractCommand(contract.Id, _branchId), CancellationToken.None);

        ErrorOr<RentalContractResponse> result = await new UpdateRentalContractCommandHandler(Contracts, _db).Handle(
            new UpdateRentalContractCommand(
                contract.Id, _branchId, "Changed", "123", "0500000000", "101",
                contract.StartDate, contract.EndDate, 1m, "Landlord", []),
            CancellationToken.None);

        result.FirstError.Should().Be(HotelErrors.ContractLocked);
        (await _db.RentalContracts.SingleAsync(c => c.Id == new RentalContractId(contract.Id)))
            .TenantName.Should().Be("Renter");
    }
}
