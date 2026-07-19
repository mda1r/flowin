using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Organization.Domain.ValueObjects;

public sealed class Address : ValueObject
{
    public string Street { get; }
    public string City { get; }
    public string? State { get; }
    public string Country { get; }
    public string? PostalCode { get; }

    private Address(string street, string city, string? state, string country, string? postalCode)
    {
        Street = street;
        City = city;
        State = state;
        Country = country;
        PostalCode = postalCode;
    }

    public static Address Create(string street, string city, string? state, string country, string? postalCode) =>
        new(
            street.Trim(),
            city.Trim(),
            state?.Trim(),
            country.Trim().ToUpperInvariant(),
            postalCode?.Trim().ToUpperInvariant());

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Street;
        yield return City;
        yield return State;
        yield return Country;
        yield return PostalCode;
    }

    public override string ToString() =>
        $"{Street}, {City}{(State is not null ? $", {State}" : string.Empty)} {PostalCode}, {Country}";
}
