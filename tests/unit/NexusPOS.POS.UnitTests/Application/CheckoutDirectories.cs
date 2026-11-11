using Moq;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.POS.UnitTests.Application;

// Catalogue stand-ins shared by the checkout handler tests.
internal static class CheckoutDirectories
{
    // A VAT-registered shop, like every shop until its owner switches VAT off.
    public static ITenantVatPolicy VatOn() => VatPolicy(true);

    public static ITenantVatPolicy VatPolicy(bool enabled)
    {
        Mock<ITenantVatPolicy> policy = new();
        policy.Setup(p => p.IsVatEnabledAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(enabled);
        return policy.Object;
    }

    // A catalogue without add-ons.
    public static IModifierOptionDirectory NoModifiers()
    {
        Mock<IModifierOptionDirectory> modifiers = new();
        modifiers.Setup(m => m.GetAsync(
                It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ModifierLookup.Empty);
        return modifiers.Object;
    }

    // A store without discount codes.
    public static IDiscountCodeDirectory NoCodes()
    {
        Mock<IDiscountCodeDirectory> codes = new();
        codes.Setup(c => c.FindAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DiscountCodeLookup?)null);
        return codes.Object;
    }
}
