using ErrorOr;
using FluentAssertions;
using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.UnitTests.Domain;

public sealed class EmailTests
{
    [Theory]
    [InlineData("user@example.com")]
    [InlineData("USER@EXAMPLE.COM")]
    [InlineData("user.name+tag@sub.domain.com")]
    public void Create_ValidEmail_ReturnsEmail(string input)
    {
        ErrorOr<Email> result = Email.Create(input);

        result.IsError.Should().BeFalse();
        result.Value.Value.Should().Be(input.Trim().ToLowerInvariant());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_NullOrWhitespace_ReturnsValidationError(string? input)
    {
        ErrorOr<Email> result = Email.Create(input);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Email.Empty");
    }

    [Theory]
    [InlineData("notanemail")]
    [InlineData("missing@tld")]
    [InlineData("@nodomain.com")]
    public void Create_InvalidFormat_ReturnsValidationError(string input)
    {
        ErrorOr<Email> result = Email.Create(input);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Email.Invalid");
    }

    [Fact]
    public void Create_SameAddress_AreEqual()
    {
        ErrorOr<Email> a = Email.Create("User@Example.COM");
        ErrorOr<Email> b = Email.Create("user@example.com");

        a.Value.Should().Be(b.Value);
    }

    [Fact]
    public void ToString_ReturnsNormalizedValue()
    {
        ErrorOr<Email> result = Email.Create("Test@Domain.COM");

        result.Value.ToString().Should().Be("test@domain.com");
    }
}
