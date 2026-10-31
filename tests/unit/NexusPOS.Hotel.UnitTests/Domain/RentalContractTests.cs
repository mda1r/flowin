using ErrorOr;
using FluentAssertions;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.ValueObjects;

namespace NexusPOS.Hotel.UnitTests.Domain;

public sealed class RentalContractTests
{
    private static RentalContract CreateDraft() =>
        RentalContract.Create(
            Guid.NewGuid(), Guid.NewGuid(),
            "Renter", "1234567890", "0500000000", "101",
            new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2027, 11, 1, 0, 0, 0, DateTimeKind.Utc),
            3000m, "Landlord",
            [new ContractClause(1, "Rules", "Follow the house rules.")]);

    private static ErrorOr<Success> Edit(RentalContract contract) =>
        contract.UpdateDetails(
            "New Renter", "999", "0511111111", "202",
            contract.StartDate, contract.EndDate, 3500m, "Landlord", null);

    [Fact]
    public void Create_StartsAsDraft()
    {
        CreateDraft().Status.Should().Be(ContractStatus.Draft);
    }

    [Fact]
    public void Sign_Draft_SignsDirectly()
    {
        RentalContract contract = CreateDraft();

        ErrorOr<Success> result = contract.Sign();

        result.IsError.Should().BeFalse();
        contract.Status.Should().Be(ContractStatus.Executed);
        contract.SignedAt.Should().NotBeNull();
    }

    [Fact]
    public void Activate_ThenSign_Succeeds()
    {
        RentalContract contract = CreateDraft();

        contract.Activate().IsError.Should().BeFalse();
        contract.Status.Should().Be(ContractStatus.Active);
        contract.Sign().IsError.Should().BeFalse();
        contract.Status.Should().Be(ContractStatus.Executed);
    }

    [Fact]
    public void Sign_AlreadySigned_ReturnsErrorAndKeepsSignedAt()
    {
        RentalContract contract = CreateDraft();
        contract.Sign();
        DateTime? signedAt = contract.SignedAt;

        ErrorOr<Success> result = contract.Sign();

        result.FirstError.Should().Be(HotelErrors.ContractAlreadyExecuted);
        contract.SignedAt.Should().Be(signedAt);
    }

    [Fact]
    public void Activate_Signed_ReturnsError()
    {
        RentalContract contract = CreateDraft();
        contract.Sign();

        contract.Activate().FirstError.Should().Be(HotelErrors.ContractAlreadyExecuted);
        contract.Status.Should().Be(ContractStatus.Executed);
    }

    [Fact]
    public void Cancel_Draft_Succeeds()
    {
        RentalContract contract = CreateDraft();

        contract.Cancel().IsError.Should().BeFalse();
        contract.Status.Should().Be(ContractStatus.Cancelled);
    }

    [Fact]
    public void Cancel_Signed_ReturnsError()
    {
        RentalContract contract = CreateDraft();
        contract.Sign();

        contract.Cancel().FirstError.Should().Be(HotelErrors.ContractAlreadySigned);
    }

    [Fact]
    public void Sign_Cancelled_ReturnsError()
    {
        RentalContract contract = CreateDraft();
        contract.Cancel();

        contract.Sign().FirstError.Should().Be(HotelErrors.ContractCancelled);
    }

    [Theory]
    [InlineData(ContractStatus.Draft)]
    [InlineData(ContractStatus.Active)]
    public void UpdateDetails_OpenContract_Succeeds(ContractStatus status)
    {
        RentalContract contract = CreateDraft();
        if (status == ContractStatus.Active)
        {
            contract.Activate();
        }

        Edit(contract).IsError.Should().BeFalse();
        contract.TenantName.Should().Be("New Renter");
        contract.MonthlyRent.Should().Be(3500m);
    }

    [Fact]
    public void UpdateDetails_Signed_IsRejected()
    {
        RentalContract contract = CreateDraft();
        contract.Sign();

        Edit(contract).FirstError.Should().Be(HotelErrors.ContractLocked);
        contract.UpdateClauses([]).FirstError.Should().Be(HotelErrors.ContractLocked);
        contract.TenantName.Should().Be("Renter");
        contract.Clauses.Should().HaveCount(1);
    }

    [Fact]
    public void UpdateDetails_Cancelled_IsRejected()
    {
        RentalContract contract = CreateDraft();
        contract.Cancel();

        Edit(contract).FirstError.Should().Be(HotelErrors.ContractLocked);
    }
}
