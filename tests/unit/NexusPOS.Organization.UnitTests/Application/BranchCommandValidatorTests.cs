using FluentAssertions;
using FluentValidation.Results;
using NexusPOS.Organization.Application.Commands.CreateBranch;
using NexusPOS.Organization.Application.Commands.UpdateBranch;
using NexusPOS.Organization.Domain.Enums;

namespace NexusPOS.Organization.UnitTests.Application;

public sealed class BranchCommandValidatorTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Create_BlankOptionalContacts_IsValid(string? blank)
    {
        CreateBranchCommand command = new(_tenantId, "Mall", BranchType.Retail, PhoneNumber: blank, Email: blank, Country: blank, PostalCode: blank);

        ValidationResult result = new CreateBranchCommandValidator().Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Create_MalformedEmail_IsInvalid()
    {
        CreateBranchCommand command = new(_tenantId, "Mall", BranchType.Retail, Email: "not-an-email");

        ValidationResult result = new CreateBranchCommandValidator().Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(CreateBranchCommand.Email));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Update_BlankOptionalContacts_IsValid(string blank)
    {
        UpdateBranchCommand command = new(Guid.NewGuid(), _tenantId, "Mall", BranchType.Retail, blank, blank, null, null, null, blank, blank);

        ValidationResult result = new UpdateBranchCommandValidator().Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Update_MalformedEmail_IsInvalid()
    {
        UpdateBranchCommand command = new(Guid.NewGuid(), _tenantId, "Mall", BranchType.Retail, null, "nope", null, null, null, null, null);

        ValidationResult result = new UpdateBranchCommandValidator().Validate(command);

        result.IsValid.Should().BeFalse();
    }
}
