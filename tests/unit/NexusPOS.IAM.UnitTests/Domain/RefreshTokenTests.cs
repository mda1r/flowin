using FluentAssertions;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.UnitTests.Domain;

public sealed class RefreshTokenTests
{
    private static UserId UserId => new(Guid.NewGuid());

    [Fact]
    public void Create_ValidInputs_CreatesActiveToken()
    {
        RefreshToken token = RefreshToken.Create(UserId, expiryDays: 7);

        token.IsActive.Should().BeTrue();
        token.IsRevoked.Should().BeFalse();
        token.IsExpired.Should().BeFalse();
        token.Token.Should().HaveLength(64);
        token.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public void Create_WithDeviceInfo_StoresDeviceInfo()
    {
        string deviceInfo = "Mozilla/5.0 Chrome/123";

        RefreshToken token = RefreshToken.Create(UserId, 7, deviceInfo);

        token.DeviceInfo.Should().Be(deviceInfo);
    }

    [Fact]
    public void Revoke_ActiveToken_BecomesInactive()
    {
        RefreshToken token = RefreshToken.Create(UserId, 7);

        token.Revoke();

        token.IsRevoked.Should().BeTrue();
        token.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Token_IsUnique_ForEachCreate()
    {
        RefreshToken a = RefreshToken.Create(UserId, 7);
        RefreshToken b = RefreshToken.Create(UserId, 7);

        a.Token.Should().NotBe(b.Token);
    }

    [Fact]
    public void Create_ZeroExpiryDays_ExpiresImmediately()
    {
        RefreshToken token = RefreshToken.Create(UserId, expiryDays: 0);

        token.IsExpired.Should().BeTrue();
        token.IsActive.Should().BeFalse();
    }
}
