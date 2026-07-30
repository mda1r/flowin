using ErrorOr;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Zatca.Application.Common;
using NexusPOS.Zatca.Domain.Entities;
using NexusPOS.Zatca.Domain.Repositories;
using NexusPOS.Zatca.Infrastructure.Persistence;

namespace NexusPOS.Zatca.Application.Commands.SaveZatcaSettings;

internal sealed class SaveZatcaSettingsCommandHandler(
    IZatcaSettingsRepository repository,
    ZatcaDbContext dbContext)
    : ICommandHandler<SaveZatcaSettingsCommand, ZatcaSettingsResponse>
{
    public async Task<ErrorOr<ZatcaSettingsResponse>> Handle(
        SaveZatcaSettingsCommand request,
        CancellationToken cancellationToken)
    {
        ZatcaSettings? existing = await repository.FindByTenantAsync(request.TenantId, cancellationToken);

        ZatcaSettings settings;
        if (existing is null)
        {
            settings = ZatcaSettings.Create(request.TenantId, request.SellerName, request.VatRegistrationNumber);
            settings.Update(request.SellerName, request.VatRegistrationNumber, request.IsPhase2Enabled, request.CertificateBase64, request.CertificateExpiryDate);
            repository.Add(settings);
        }
        else
        {
            existing.Update(request.SellerName, request.VatRegistrationNumber, request.IsPhase2Enabled, request.CertificateBase64, request.CertificateExpiryDate);
            settings = existing;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return ToResponse(settings);
    }

    private static ZatcaSettingsResponse ToResponse(ZatcaSettings s) =>
        new(s.Id, s.SellerName, s.VatRegistrationNumber, s.IsPhase2Enabled,
            s.CertificateBase64 is not null, s.CertificateExpiryDate, s.InvoiceCounter, s.UpdatedAt);
}
