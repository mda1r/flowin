using FluentAssertions;
using NexusPOS.Gaming.Domain;
using NexusPOS.Gaming.Domain.Entities;

namespace NexusPOS.Gaming.UnitTests.Domain;

public sealed class GameSessionPaymentTests
{
    private static GameSession NewSession() =>
        GameSession.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "أحمد", 60, 20m);

    [Fact]
    public void ActiveSession_CannotBePaid()
    {
        NewSession().MarkPaid("Cash").FirstError.Should().Be(GamingErrors.SessionNotCompleted);
    }

    [Fact]
    public void CompletedSession_RecordsMethodAndTime()
    {
        GameSession session = NewSession();
        session.Complete();

        session.MarkPaid("Card").IsError.Should().BeFalse();

        session.PaymentMethod.Should().Be("Card");
        session.PaidAt.Should().NotBeNull();
    }

    [Fact]
    public void Session_CannotBePaidTwice()
    {
        GameSession session = NewSession();
        session.Complete();
        session.MarkPaid("Cash");

        session.MarkPaid("Cash").FirstError.Should().Be(GamingErrors.SessionAlreadyPaid);
    }
}
