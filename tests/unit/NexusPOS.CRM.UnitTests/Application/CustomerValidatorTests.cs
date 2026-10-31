using FluentAssertions;
using NexusPOS.CRM.Application.Commands.AddLoyaltyPoints;
using NexusPOS.CRM.Application.Commands.CreateCustomer;
using NexusPOS.CRM.Application.Commands.RedeemLoyaltyPoints;
using NexusPOS.CRM.Application.Commands.UpdateCustomer;
using NexusPOS.CRM.Domain.Entities;

namespace NexusPOS.CRM.UnitTests.Application;

public sealed class CustomerValidatorTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();

    [Fact]
    public void Create_WithOnlyNameAndBlankFields_IsValid()
    {
        CreateCustomerCommand command = new(_tenantId, "Walk-in", Email: "", Phone: "0500000000", Address: "", Notes: "");

        new CreateCustomerCommandValidator().Validate(command).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Create_WithBadEmail_IsInvalid()
    {
        CreateCustomerCommand command = new(_tenantId, "Jane", Email: "not-an-email");

        new CreateCustomerCommandValidator().Validate(command).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Update_WithWhitespaceEmail_IsValid()
    {
        UpdateCustomerCommand command = new(Guid.NewGuid(), _tenantId, "Jane", Email: "   ");

        new UpdateCustomerCommandValidator().Validate(command).IsValid.Should().BeTrue();
    }

    [Fact]
    public void AddPoints_WithoutReason_IsInvalid()
    {
        AddLoyaltyPointsCommand command = new(Guid.NewGuid(), _tenantId, 50, " ");

        new AddLoyaltyPointsCommandValidator().Validate(command).IsValid.Should().BeFalse();
    }

    [Fact]
    public void RedeemPoints_WithReason_IsValid()
    {
        RedeemLoyaltyPointsCommand command = new(Guid.NewGuid(), _tenantId, 50, "Gift card", Guid.NewGuid());

        new RedeemLoyaltyPointsCommandValidator().Validate(command).IsValid.Should().BeTrue();
    }

    [Fact]
    public void LoyaltyTransaction_TrimsAndCapsReason()
    {
        LoyaltyTransaction row = LoyaltyTransaction.Create(
            _tenantId, Guid.NewGuid(), 10, LoyaltyTransactionKind.Adjust, reason: "  " + new string('x', 300));

        row.Reason.Should().HaveLength(LoyaltyTransaction.MaxReasonLength);
        LoyaltyTransaction.Create(_tenantId, Guid.NewGuid(), 10, LoyaltyTransactionKind.Earn, reason: " ")
            .Reason.Should().BeNull();
    }
}
