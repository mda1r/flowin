using ErrorOr;
using FluentAssertions;
using FluentValidation.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;
using NexusPOS.Zatca.Application.Commands.SaveZatcaSettings;
using NexusPOS.Zatca.Application.Common;
using NexusPOS.Zatca.Domain.Entities;
using NexusPOS.Zatca.Infrastructure.Persistence;
using NexusPOS.Zatca.Infrastructure.Persistence.Repositories;

namespace NexusPOS.Zatca.UnitTests.Application;

public sealed class SaveZatcaSettingsTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private const string ValidVat = "310123456700003";

    [Fact]
    public void Update_WithoutCertificate_KeepsTheStoredCertificate()
    {
        ZatcaSettings settings = ZatcaSettings.Create(_tenantId, "متجر النور", ValidVat);
        DateTime expiry = new(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        settings.Update("متجر النور", ValidVat, true, "Q0VSVA==", expiry);

        settings.Update("متجر النور الجديد", ValidVat, true, null, null);

        settings.SellerName.Should().Be("متجر النور الجديد");
        settings.CertificateBase64.Should().Be("Q0VSVA==");
        settings.CertificateExpiryDate.Should().Be(expiry);
    }

    [Fact]
    public void Update_WithNewCertificate_ReplacesIt()
    {
        ZatcaSettings settings = ZatcaSettings.Create(_tenantId, "متجر", ValidVat);
        settings.Update("متجر", ValidVat, true, "T0xE", null);

        DateTime expiry = new(2028, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        settings.Update("متجر", ValidVat, true, "TkVX", expiry);

        settings.CertificateBase64.Should().Be("TkVX");
        settings.CertificateExpiryDate.Should().Be(expiry);
    }

    [Fact]
    public async Task Handler_SavingSellerDetails_DoesNotWipeCertificate()
    {
        await using ZatcaDbContext db = CreateDb();
        ZatcaSettings existing = ZatcaSettings.Create(_tenantId, "متجر", ValidVat);
        existing.Update("متجر", ValidVat, true, "Q0VSVA==", null);
        db.ZatcaSettings.Add(existing);
        await db.SaveChangesAsync();

        SaveZatcaSettingsCommandHandler handler = new(new ZatcaSettingsRepository(db), db);
        ErrorOr<ZatcaSettingsResponse> result = await handler.Handle(
            new SaveZatcaSettingsCommand(_tenantId, "متجر النور", ValidVat, true, null, null),
            CancellationToken.None);

        result.Value.HasCertificate.Should().BeTrue();
        result.Value.SellerName.Should().Be("متجر النور");
    }

    [Theory]
    [InlineData("310123456700003")]
    [InlineData("300000000000003")]
    public void Validator_AcceptsZatcaVatNumbers(string vat)
    {
        Validate("متجر", vat).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("3101234567")]
    [InlineData("31012345670000")]
    [InlineData("3101234567000033")]
    [InlineData("210123456700003")]
    [InlineData("310123456700002")]
    [InlineData("31012345670000A")]
    public void Validator_RejectsInvalidVatNumbers(string vat)
    {
        ValidationResult result = Validate("متجر", vat);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveZatcaSettingsCommand.VatRegistrationNumber));
    }

    [Fact]
    public void Validator_RequiresSellerName()
    {
        ValidationResult result = Validate("  ", ValidVat);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveZatcaSettingsCommand.SellerName));
    }

    private static ValidationResult Validate(string name, string vat) =>
        new SaveZatcaSettingsCommandValidator().Validate(
            new SaveZatcaSettingsCommand(_tenantId, name, vat, false, null, null));

    private static ZatcaDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ZatcaDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options,
            Mock.Of<IPublisher>());
}
