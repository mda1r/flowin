using ErrorOr;
using FluentAssertions;
using FluentValidation.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Moq;
using NexusPOS.POS.Application.Commands.Checkout;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.UnitTests.Application;

// The name the barista calls out travels from the till to the kitchen ticket, trimmed and at most 40 characters.
public sealed class CheckoutCallNameTests
{
    private static readonly Guid _latte = Guid.NewGuid();

    private static CheckoutOrderCommand Sale(Guid tenantId, CheckoutOrderCommand.KitchenTicket? kitchen) =>
        new(tenantId, Guid.NewGuid(), Guid.NewGuid(), "SAR", 0.15m, null,
            [new(_latte, "لاتيه", "كبير", 20m, 0m, 1m)],
            0, PaymentMethod.Card, 0m, null, null, null, ByOwnerOrManager: true, Kitchen: kitchen);

    [Fact]
    public void Validator_CallNameOver40_IsRejected()
    {
        ValidationResult result = new CheckoutOrderCommandValidator()
            .Validate(Sale(Guid.NewGuid(), new(null, true, new string('ن', 41))));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.ErrorMessage.Contains("اسم المناداة"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("سارة")]
    [InlineData("  سارة  ")]
    public void Validator_ShortOrMissingCallName_IsAccepted(string? callName)
    {
        new CheckoutOrderCommandValidator().Validate(Sale(Guid.NewGuid(), new(null, true, callName))).IsValid.Should().BeTrue();
        new CheckoutOrderCommandValidator().Validate(Sale(Guid.NewGuid(), null)).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validator_CountsTheTrimmedName()
    {
        string padded = "  " + new string('ن', 40) + "  ";
        new CheckoutOrderCommandValidator().Validate(Sale(Guid.NewGuid(), new(null, true, padded))).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("  سارة ", "سارة")]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public async Task Checkout_SendsTheTrimmedCallNameToTheKitchen(string? typed, string? expected)
    {
        Mock<IPublisher> publisher = new();
        List<KitchenTicketRequestedDomainEvent> tickets = [];
        publisher.Setup(p => p.Publish(It.IsAny<KitchenTicketRequestedDomainEvent>(), It.IsAny<CancellationToken>()))
            .Callback<KitchenTicketRequestedDomainEvent, CancellationToken>((e, _) => tickets.Add(e))
            .Returns(Task.CompletedTask);

        await using PosDbContext db = new(
            new DbContextOptionsBuilder<PosDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options,
            new Mock<IPublisher>().Object);
        Mock<ICustomerLoyaltyDirectory> loyalty = new();
        loyalty.Setup(l => l.GetRulesAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(LoyaltyRules.Default);
        Mock<IOrderNumberSequence> numbers = new();
        numbers.Setup(n => n.NextAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(1001);
        Mock<IVariantPriceDirectory> prices = new();
        prices.Setup(p => p.GetProductIdsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, Guid>());
        prices.Setup(p => p.GetCostPricesAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal>());
        Mock<IRecipeCostDirectory> recipes = new();
        recipes.Setup(r => r.GetCostsAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal>());
        CheckoutOrderCommandHandler handler = new(
            db, loyalty.Object, numbers.Object, prices.Object, recipes.Object, CheckoutDirectories.NoModifiers(), CheckoutDirectories.NoCodes(), publisher.Object, CheckoutDirectories.VatOn());

        Guid tenantId = Guid.NewGuid();
        ErrorOr<OrderResponse> result = await handler.Handle(Sale(tenantId, new(null, true, typed)), CancellationToken.None);

        result.IsError.Should().BeFalse();
        KitchenTicketRequestedDomainEvent ticket = tickets.Should().ContainSingle().Subject;
        ticket.CallName.Should().Be(expected);
        ticket.TenantId.Should().Be(tenantId);
        ticket.Takeaway.Should().BeTrue();
    }
}
