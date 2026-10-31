using FluentAssertions;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Infrastructure.Persistence.Repositories;

namespace NexusPOS.CRM.UnitTests.Infrastructure;

// The phone terms a customer search uses, and the order its results come back in.
public sealed class CustomerSearchTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();

    [Theory]
    [InlineData("0551234567")]
    [InlineData("+966551234567")]
    [InlineData("٠٥٥١٢٣٤٥٦٧")]
    [InlineData("055 123 4567")]
    public void AFullNumber_FindsItInEveryStoredForm(string typed)
    {
        CustomerSearch search = CustomerSearch.Parse(typed);

        search.Key.Should().Be("966551234567");
        search.ExactPhones.Should().Contain(["+966551234567", "966551234567", "0551234567", "551234567"]);
    }

    [Fact]
    public void ArabicIndicDigits_AlsoMatchOldRowsAsDigits()
    {
        CustomerSearch search = CustomerSearch.Parse("٠٥٥١٢");

        search.Digits.Should().Be("05512");
        search.Key.Should().Be("9665512");
    }

    [Fact]
    public void AShortPrefix_StaysAsTyped()
    {
        CustomerSearch.Parse("055").Key.Should().Be("055");
    }

    [Fact]
    public void ANameWithADigit_GetsNoPhoneTerms()
    {
        CustomerSearch search = CustomerSearch.Parse(" محمد 2 ");

        search.Digits.Should().Be("محمد 2");
        search.Key.Should().Be("محمد 2");
        search.ExactPhones.Should().BeEmpty();
    }

    [Fact]
    public void AnExactPhoneMatch_IsSortedFirst_ThenByName()
    {
        Customer aisha = Customer.Create(_tenantId, "Aisha", phone: "0551234500");
        Customer badr = Customer.Create(_tenantId, "Badr", phone: "0551234567");
        Customer carl = Customer.Create(_tenantId, "Carl", phone: "0551234560");
        Customer old = Customer.Create(_tenantId, "Zaid");
        typeof(Customer).GetProperty(nameof(Customer.Phone))!.SetValue(old, "0551234567");

        List<string> names = [.. CustomerSearch.Parse("٠٥٥١٢٣٤٥٦٧")
            .ExactPhoneFirst(new[] { carl, aisha, old, badr }.AsQueryable())
            .Select(c => c.Name)];

        names.Should().Equal("Badr", "Zaid", "Aisha", "Carl");
    }
}
