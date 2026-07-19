using ErrorOr;
using FluentAssertions;
using NexusPOS.POS.Domain;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;

namespace NexusPOS.POS.UnitTests.Domain;

public sealed class DiscountTests
{
    [Fact]
    public void None_ReturnsZeroDiscount()
    {
        Discount discount = Discount.None();

        discount.Type.Should().Be(DiscountType.None);
        discount.Value.Should().Be(0m);
        discount.ComputeAmount(500m).Should().Be(0m);
    }

    [Fact]
    public void Create_PercentageDiscount_ComputesCorrectly()
    {
        ErrorOr<Discount> result = Discount.Create(DiscountType.Percentage, 10m);

        result.IsError.Should().BeFalse();
        result.Value.ComputeAmount(200m).Should().Be(20m);
    }

    [Fact]
    public void Create_FixedDiscount_ComputesCorrectly()
    {
        ErrorOr<Discount> result = Discount.Create(DiscountType.Fixed, 15m);

        result.IsError.Should().BeFalse();
        result.Value.ComputeAmount(200m).Should().Be(15m);
    }

    [Fact]
    public void Create_FixedDiscountExceedsSubtotal_ClampsToSubtotal()
    {
        ErrorOr<Discount> result = Discount.Create(DiscountType.Fixed, 999m);

        result.IsError.Should().BeFalse();
        result.Value.ComputeAmount(100m).Should().Be(100m);
    }

    [Fact]
    public void Create_PercentageOver100_ReturnsError()
    {
        ErrorOr<Discount> result = Discount.Create(DiscountType.Percentage, 101m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PosErrors.DiscountPercentageExceedsHundred);
    }

    [Fact]
    public void Create_NegativeValue_ReturnsError()
    {
        ErrorOr<Discount> result = Discount.Create(DiscountType.Fixed, -1m);

        result.IsError.Should().BeTrue();
        result.FirstError.Should().Be(PosErrors.InvalidDiscountValue);
    }
}
