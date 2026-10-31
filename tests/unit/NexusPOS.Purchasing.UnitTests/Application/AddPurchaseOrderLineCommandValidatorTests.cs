using FluentAssertions;
using FluentValidation.Results;
using NexusPOS.Purchasing.Application.Commands.AddPurchaseOrderLine;

namespace NexusPOS.Purchasing.UnitTests.Application;

public sealed class AddPurchaseOrderLineCommandValidatorTests
{
    private readonly AddPurchaseOrderLineCommandValidator _validator = new();

    private static AddPurchaseOrderLineCommand Command(Guid? variantId, Guid? stockMaterialId) =>
        new(Guid.NewGuid(), Guid.NewGuid(), variantId, "Milk 1L", 4.5m, 10m, stockMaterialId);

    [Fact]
    public void VariantOnly_IsValid()
    {
        ValidationResult result = _validator.Validate(Command(Guid.NewGuid(), null));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void StockMaterialOnly_IsValid()
    {
        ValidationResult result = _validator.Validate(Command(null, Guid.NewGuid()));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void NeitherItem_IsInvalid()
    {
        ValidationResult result = _validator.Validate(Command(null, null));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void EmptyGuids_AreTreatedAsMissing()
    {
        ValidationResult result = _validator.Validate(Command(Guid.Empty, Guid.Empty));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void BothItems_IsInvalid()
    {
        ValidationResult result = _validator.Validate(Command(Guid.NewGuid(), Guid.NewGuid()));

        result.IsValid.Should().BeFalse();
    }
}
