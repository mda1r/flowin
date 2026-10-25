using ErrorOr;
using FluentAssertions;
using NexusPOS.SharedKernel.Application.Behaviors;

namespace NexusPOS.SharedKernel.UnitTests;

public sealed class LogRedactorTests
{
    private sealed record LoginCommand(string Email, string Password, string? DeviceInfo);

    private sealed record Tokens(string AccessToken, string RefreshToken, DateTime ExpiresAt);

    private sealed record SaveSettings(string PhoneNumberId, string? AccessToken, string Base64, IReadOnlyList<int> Ids);

    [Fact]
    public void Passwords_AreNeverLogged()
    {
        var shape = (Dictionary<string, object?>)LogRedactor.Describe(new LoginCommand("a@b.com", "hunter2!", null))!;

        shape["Email"].Should().Be("a@b.com");
        shape["Password"].Should().Be("***");
    }

    [Fact]
    public void Tokens_InsideAResult_AreNeverLogged()
    {
        ErrorOr<Tokens> result = new Tokens("eyJ.access", "refresh-123", DateTime.UnixEpoch);

        string text = Flatten(LogRedactor.Describe(result));

        text.Should().NotContain("eyJ.access").And.NotContain("refresh-123");
        text.Should().Contain("***");
    }

    [Fact]
    public void UploadsAndLongLists_AreSummarised()
    {
        var shape = (Dictionary<string, object?>)LogRedactor.Describe(
            new SaveSettings("123", "secret", new string('A', 10_000), [.. Enumerable.Range(1, 50)]))!;

        shape["AccessToken"].Should().Be("***");
        shape["Base64"].Should().Be("***");
        ((List<object?>)shape["Ids"]!).Should().HaveCount(11).And.Contain("… 40 more");
        shape["PhoneNumberId"].Should().Be("123");
    }

    [Theory]
    [InlineData("Password", true)]
    [InlineData("NewPassword", true)]
    [InlineData("refresh_token", true)]
    [InlineData("ClientSecret", true)]
    [InlineData("Email", false)]
    [InlineData("TokenHint", true)]
    [InlineData("Name", false)]
    public void SensitiveNames_AreRecognised(string name, bool sensitive) =>
        LogRedactor.IsSensitive(name).Should().Be(sensitive);

    private static string Flatten(object? value) => value switch
    {
        Dictionary<string, object?> d => string.Join(",", d.Select(kv => kv.Key + "=" + Flatten(kv.Value))),
        List<object?> l => "[" + string.Join(",", l.Select(Flatten)) + "]",
        _ => value?.ToString() ?? "null",
    };
}
