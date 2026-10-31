using FluentAssertions;
using NexusPOS.Restaurant.Application.EventHandlers;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Restaurant.UnitTests.Application;

// Pins the kitchen ticket's line names to the till's lineDisplayName (frontend/src/lib/variantName.ts).
public sealed class KitchenTicketItemNameTests
{
    private static string Name(string product, string variant) =>
        KitchenTicketRequestedRestaurantHandler.ItemName(
            new KitchenTicketRequestedDomainEvent.Line(Guid.NewGuid(), product, variant, 1m, null));

    [Fact]
    public void ItemName_AddsARealSize()
    {
        Name("لاتيه", "كبير").Should().Be("لاتيه - كبير");
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("افتراضي")]
    [InlineData("Standard")]
    [InlineData("Default")]
    [InlineData(" شاي ")]
    public void ItemName_PlainVariantIsJustTheProduct(string variant)
    {
        Name("شاي", variant).Should().Be("شاي");
    }

    [Fact]
    public void ItemName_IsCappedAt128Characters()
    {
        Name(new string('ق', 120), "كبير جداً").Should().HaveLength(128);
    }
}
