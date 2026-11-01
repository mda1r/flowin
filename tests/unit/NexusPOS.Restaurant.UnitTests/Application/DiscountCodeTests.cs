using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NexusPOS.Restaurant.Application.Commands.CreateDiscountCode;
using NexusPOS.Restaurant.Application.Commands.DeleteDiscountCode;
using NexusPOS.Restaurant.Application.Commands.UpdateDiscountCode;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Application.Services;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Enums;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.Restaurant.Infrastructure.Persistence.Repositories;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.Restaurant.UnitTests.Application;

// The owner's discount codes: one per text per tenant whatever the letter case, and a code the till can use only
// while it is on, before its expiry and with uses left.
public sealed class DiscountCodeTests
{
    private static readonly DateTime _now = new(2026, 11, 2, 12, 0, 0, DateTimeKind.Utc);

    private static RestaurantDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<RestaurantDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options,
            new Mock<IPublisher>().Object);

    private static DiscountCode Code(
        Guid tenantId, string code = "staff", decimal percent = 10m, int maxUses = 0, DateTime? expiry = null, string? label = "موظفين") =>
        DiscountCode.Create(tenantId, code, DiscountCodeType.Percentage, percent, 0m, maxUses, expiry, label).Value;

    [Fact]
    public void Create_StoresTheCodeTrimmedAndUpperCase_WithItsLabel()
    {
        DiscountCode code = Code(Guid.NewGuid(), "  vip10 ", label: "  VIP  ");

        code.Code.Should().Be("VIP10");
        code.Label.Should().Be("VIP");
        code.ExpiryDate.Should().BeNull();
        code.IsActive.Should().BeTrue();
        DiscountCode.Normalize(" Vip10").Should().Be("VIP10");
    }

    [Fact]
    public void CheckUsable_FollowsActiveExpiryAndUses()
    {
        Guid tenantId = Guid.NewGuid();
        Code(tenantId).CheckUsable(_now).IsError.Should().BeFalse("no expiry and unlimited uses");

        Code(tenantId, expiry: _now.AddMinutes(-1)).CheckUsable(_now).FirstError.Should().Be(RestaurantErrors.DiscountCodeExpired);
        Code(tenantId, expiry: _now.AddMinutes(1)).CheckUsable(_now).IsError.Should().BeFalse();

        DiscountCode off = Code(tenantId);
        off.Deactivate();
        off.CheckUsable(_now).FirstError.Should().Be(RestaurantErrors.DiscountCodeInactive);
        off.Activate();
        off.CheckUsable(_now).IsError.Should().BeFalse();

        DiscountCode twice = Code(tenantId, maxUses: 2);
        twice.IncrementUsage();
        twice.CheckUsable(_now).IsError.Should().BeFalse();
        twice.IncrementUsage();
        twice.CheckUsable(_now).FirstError.Should().Be(RestaurantErrors.DiscountCodeMaxUsesReached);
    }

    [Fact]
    public void Create_AcceptsAHundredPercent_ButNotMore()
    {
        DiscountCode.Create(Guid.NewGuid(), "FREE", DiscountCodeType.Percentage, 100m, 0m, 0, null).IsError.Should().BeFalse();
        DiscountCode.Create(Guid.NewGuid(), "TOO", DiscountCodeType.Percentage, 101m, 0m, 0, null)
            .FirstError.Should().Be(RestaurantErrors.DiscountPercentageExceedsHundred);
    }

    [Fact]
    public void Update_KeepsTheUsedCount_AndARefusedChangeLeavesItAlone()
    {
        DiscountCode code = Code(Guid.NewGuid(), maxUses: 5);
        code.IncrementUsage();

        code.Update("staff2", "طاقم", DiscountCodeType.Percentage, 15m, 0m, 10, null, false).IsError.Should().BeFalse();
        code.Code.Should().Be("STAFF2");
        code.Value.Should().Be(15m);
        code.IsActive.Should().BeFalse();
        code.UsedCount.Should().Be(1);

        code.Update("staff3", null, DiscountCodeType.Percentage, 0m, 0m, 10, null, true).IsError.Should().BeTrue();
        code.Code.Should().Be("STAFF2");
        code.IsActive.Should().BeFalse();
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(0.5, false)]
    [InlineData(1, true)]
    [InlineData(5, true)]
    [InlineData(100, true)]
    [InlineData(101, false)]
    public void Validator_PercentageIsOneToAHundred(decimal percent, bool valid)
    {
        CreateDiscountCodeCommand command = new(Guid.NewGuid(), "STAFF", DiscountCodeType.Percentage, percent, 0m, 0, null, "موظفين");

        new CreateDiscountCodeCommandValidator().Validate(command).IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData("", false)]
    [InlineData("STAFF 10", false)]
    [InlineData("  STAFF10  ", true)]
    [InlineData("قهوة", true)]
    public void Validator_CodeHasNoSpacesInside(string code, bool valid)
    {
        CreateDiscountCodeCommand command = new(Guid.NewGuid(), code, DiscountCodeType.Percentage, 10m, 0m, 0, null);

        new CreateDiscountCodeCommandValidator().Validate(command).IsValid.Should().Be(valid);
    }

    [Fact]
    public void Validator_ExpiryIsOptional_ButNotInThePast()
    {
        CreateDiscountCodeCommandValidator validator = new();
        validator.Validate(new CreateDiscountCodeCommand(Guid.NewGuid(), "A", DiscountCodeType.Percentage, 10m, 0m, 0, null))
            .IsValid.Should().BeTrue();
        validator.Validate(new CreateDiscountCodeCommand(
                Guid.NewGuid(), "A", DiscountCodeType.Percentage, 10m, 0m, 0, DateTime.UtcNow.AddDays(-1)))
            .IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task Create_RefusesTheSameCodeInAnyCase_ButAnotherTenantMayUseIt()
    {
        await using RestaurantDbContext db = CreateDb();
        CreateDiscountCodeCommandHandler handler = new(new DiscountCodeRepository(db), db);
        Guid tenantId = Guid.NewGuid();

        ErrorOr<DiscountCodeResponse> first = await handler.Handle(
            new(tenantId, "Staff", DiscountCodeType.Percentage, 10m, 0m, 0, null, "موظفين"), CancellationToken.None);
        ErrorOr<DiscountCodeResponse> again = await handler.Handle(
            new(tenantId, " STAFF ", DiscountCodeType.Percentage, 20m, 0m, 0, null), CancellationToken.None);
        ErrorOr<DiscountCodeResponse> elsewhere = await handler.Handle(
            new(Guid.NewGuid(), "staff", DiscountCodeType.Percentage, 20m, 0m, 0, null), CancellationToken.None);

        first.Value.Code.Should().Be("STAFF");
        first.Value.Label.Should().Be("موظفين");
        again.FirstError.Should().Be(RestaurantErrors.DiscountCodeExists);
        elsewhere.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAndDelete_OnlyTouchTheCallersTenant()
    {
        await using RestaurantDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();
        DiscountCode code = Code(tenantId);
        DiscountCode other = Code(tenantId, "VIP");
        db.DiscountCodes.AddRange(code, other);
        await db.SaveChangesAsync();
        DiscountCodeRepository repository = new(db);
        UpdateDiscountCodeCommandHandler update = new(repository, db);
        DeleteDiscountCodeCommandHandler delete = new(repository, db);

        (await update.Handle(new(Guid.NewGuid(), code.Id.Value, "STAFF", null, DiscountCodeType.Percentage, 30m, 0m, 0, null, true), CancellationToken.None))
            .FirstError.Should().Be(RestaurantErrors.DiscountCodeNotFound);
        (await update.Handle(new(tenantId, code.Id.Value, "vip", null, DiscountCodeType.Percentage, 30m, 0m, 0, null, true), CancellationToken.None))
            .FirstError.Should().Be(RestaurantErrors.DiscountCodeExists);
        ErrorOr<DiscountCodeResponse> renamed = await update.Handle(
            new(tenantId, code.Id.Value, "staff", "موظفين", DiscountCodeType.Percentage, 30m, 0m, 0, null, false), CancellationToken.None);
        renamed.Value.Value.Should().Be(30m);
        renamed.Value.IsActive.Should().BeFalse();

        (await delete.Handle(new(Guid.NewGuid(), code.Id.Value), CancellationToken.None))
            .FirstError.Should().Be(RestaurantErrors.DiscountCodeNotFound);
        (await delete.Handle(new(tenantId, code.Id.Value), CancellationToken.None)).IsError.Should().BeFalse();
        (await db.DiscountCodes.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Directory_FindsTheCodeInAnyCase_ForItsTenantOnly_AndSaysWhyItCannotBeUsed()
    {
        await using RestaurantDbContext db = CreateDb();
        Guid tenantId = Guid.NewGuid();
        DiscountCode staff = Code(tenantId, "STAFF", 30m);
        DiscountCode old = Code(tenantId, "OLD", expiry: DateTime.UtcNow.AddDays(-1));
        DiscountCode off = Code(tenantId, "OFF");
        off.Deactivate();
        DiscountCode once = Code(tenantId, "ONCE", maxUses: 1);
        once.IncrementUsage();
        db.DiscountCodes.AddRange(staff, old, off, once, Code(Guid.NewGuid(), "THEIRS"));
        await db.SaveChangesAsync();
        DiscountCodeDirectory directory = new(db, NullLogger<DiscountCodeDirectory>.Instance);

        DiscountCodeLookup? found = await directory.FindAsync(tenantId, "  staff ");

        found.Should().Be(new DiscountCodeLookup("STAFF", "موظفين", true, 30m, 0m, null));
        (await directory.FindAsync(tenantId, "theirs")).Should().BeNull();
        (await directory.FindAsync(tenantId, "nope")).Should().BeNull();
        (await directory.FindAsync(tenantId, "  ")).Should().BeNull();
        (await directory.FindAsync(tenantId, "old"))!.Problem.Should().Be(RestaurantErrors.DiscountCodeExpired.Description);
        (await directory.FindAsync(tenantId, "old", DateTime.UtcNow.AddDays(-2)))!.Problem
            .Should().BeNull("a sale made offline before the expiry could still use it");
        (await directory.FindAsync(tenantId, "off"))!.Problem.Should().Be(RestaurantErrors.DiscountCodeInactive.Description);
        (await directory.FindAsync(tenantId, "once"))!.Problem.Should().Be(RestaurantErrors.DiscountCodeMaxUsesReached.Description);
    }
}
