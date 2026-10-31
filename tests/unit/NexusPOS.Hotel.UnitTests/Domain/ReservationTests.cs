using ErrorOr;
using FluentAssertions;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;

namespace NexusPOS.Hotel.UnitTests.Domain;

public sealed class ReservationTests
{
    private static readonly DateTime _checkIn = new(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime _checkOut = new(2026, 11, 5, 0, 0, 0, DateTimeKind.Utc);

    private static Reservation CreateFourNights() =>
        Reservation.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Guest", "1234567890", "0500000000",
            _checkIn, _checkOut, 200m).Value;

    [Fact]
    public void Create_StoresNetTotalForBookedNights()
    {
        Reservation reservation = CreateFourNights();

        reservation.Nights.Should().Be(4);
        reservation.TotalAmount.Should().Be(800m);
        reservation.Status.Should().Be(ReservationStatus.Active);
    }

    // ── Complete (check-out) ──────────────────────────────────────────────────

    [Fact]
    public void Complete_OnBookedDate_KeepsBookedNights()
    {
        Reservation reservation = CreateFourNights();

        ErrorOr<Success> result = reservation.Complete(_checkOut.AddHours(11));

        result.IsError.Should().BeFalse();
        reservation.Status.Should().Be(ReservationStatus.CheckedOut);
        reservation.Nights.Should().Be(4);
        reservation.TotalAmount.Should().Be(800m);
        reservation.CheckOut.Should().Be(_checkOut);
    }

    [Fact]
    public void Complete_EarlyCheckout_BillsOnlyNightsStayed()
    {
        Reservation reservation = CreateFourNights();
        DateTime leftAt = new(2026, 11, 3, 10, 0, 0, DateTimeKind.Utc);

        reservation.Complete(leftAt);

        reservation.Nights.Should().Be(2);
        reservation.TotalAmount.Should().Be(400m);
        reservation.CheckOut.Should().Be(leftAt);
    }

    [Fact]
    public void Complete_OnBookedDateBeforeThreeAmRiyadh_KeepsBookedNights()
    {
        // Booked 30 Oct to 1 Nov; leaves 1 Nov 02:00 Riyadh time, which is still 31 Oct in UTC.
        Reservation reservation = Reservation.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Guest", "1234567890", "0500000000",
            new DateTime(2026, 10, 30, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc), 200m).Value;

        reservation.Complete(new DateTime(2026, 10, 31, 23, 0, 0, DateTimeKind.Utc));

        reservation.Nights.Should().Be(2);
        reservation.TotalAmount.Should().Be(400m);
        reservation.CheckOut.Should().Be(new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void Complete_SameDayCheckout_BillsOneNight()
    {
        Reservation reservation = CreateFourNights();

        reservation.Complete(_checkIn.AddHours(15));

        reservation.Nights.Should().Be(1);
        reservation.TotalAmount.Should().Be(200m);
    }

    [Fact]
    public void Complete_LateCheckout_KeepsBookedNights()
    {
        Reservation reservation = CreateFourNights();

        reservation.Complete(_checkOut.AddDays(2));

        reservation.Nights.Should().Be(4);
        reservation.TotalAmount.Should().Be(800m);
    }

    [Fact]
    public void Complete_AlreadyCheckedOut_ReturnsError()
    {
        Reservation reservation = CreateFourNights();
        reservation.Complete(_checkOut);

        ErrorOr<Success> result = reservation.Complete(_checkOut);

        result.FirstError.Should().Be(HotelErrors.ReservationNotActive);
    }

    // ── Extend ────────────────────────────────────────────────────────────────

    [Fact]
    public void Extend_LaterDate_RecalculatesNightsAndTotal()
    {
        Reservation reservation = CreateFourNights();
        DateTime newCheckOut = _checkOut.AddDays(2);

        ErrorOr<Success> result = reservation.Extend(newCheckOut);

        result.IsError.Should().BeFalse();
        reservation.CheckOut.Should().Be(newCheckOut);
        reservation.Nights.Should().Be(6);
        reservation.TotalAmount.Should().Be(1200m);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Extend_SameOrEarlierDate_ReturnsError(int days)
    {
        Reservation reservation = CreateFourNights();

        ErrorOr<Success> result = reservation.Extend(_checkOut.AddDays(days));

        result.FirstError.Should().Be(HotelErrors.InvalidExtendDate);
        reservation.Nights.Should().Be(4);
    }

    [Fact]
    public void Extend_CancelledReservation_ReturnsError()
    {
        Reservation reservation = CreateFourNights();
        reservation.Cancel();

        ErrorOr<Success> result = reservation.Extend(_checkOut.AddDays(1));

        result.FirstError.Should().Be(HotelErrors.ReservationNotActive);
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    [Fact]
    public void Cancel_ActiveReservation_SetsCancelled()
    {
        Reservation reservation = CreateFourNights();

        ErrorOr<Success> result = reservation.Cancel();

        result.IsError.Should().BeFalse();
        reservation.Status.Should().Be(ReservationStatus.Cancelled);
    }
}
