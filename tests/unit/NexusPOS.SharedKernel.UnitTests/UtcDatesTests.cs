using FluentAssertions;
using NexusPOS.SharedKernel.Application;

namespace NexusPOS.SharedKernel.UnitTests;

public sealed class UtcDatesTests
{
    [Fact]
    public void Unspecified_IsTreatedAsUtcWithoutShifting()
    {
        DateTime value = new(2026, 10, 24, 21, 0, 0, DateTimeKind.Unspecified);

        DateTime result = UtcDates.AsUtc(value);

        result.Kind.Should().Be(DateTimeKind.Utc);
        result.Should().Be(new DateTime(2026, 10, 24, 21, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void Local_IsConvertedToTheSameInstantInUtc()
    {
        DateTime utc = new(2026, 10, 24, 21, 0, 0, DateTimeKind.Utc);

        DateTime result = UtcDates.AsUtc(utc.ToLocalTime());

        result.Kind.Should().Be(DateTimeKind.Utc);
        result.Should().Be(utc);
    }

    [Fact]
    public void Null_StaysNull() => UtcDates.AsUtc((DateTime?)null).Should().BeNull();
}
