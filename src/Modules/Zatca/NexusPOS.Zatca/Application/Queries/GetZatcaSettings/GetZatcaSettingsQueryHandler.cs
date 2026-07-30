using ErrorOr;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Zatca.Application.Common;
using NexusPOS.Zatca.Domain;
using NexusPOS.Zatca.Domain.Entities;
using NexusPOS.Zatca.Domain.Repositories;

namespace NexusPOS.Zatca.Application.Queries.GetZatcaSettings;

internal sealed class GetZatcaSettingsQueryHandler(IZatcaSettingsRepository repository)
    : IQueryHandler<GetZatcaSettingsQuery, ZatcaSettingsResponse>
{
    public async Task<ErrorOr<ZatcaSettingsResponse>> Handle(
        GetZatcaSettingsQuery request,
        CancellationToken cancellationToken)
    {
        ZatcaSettings? settings = await repository.FindByTenantAsync(request.TenantId, cancellationToken);

        if (settings is null)
        {
            return ZatcaErrors.SettingsNotFound;
        }

        return new ZatcaSettingsResponse(
            settings.Id,
            settings.SellerName,
            settings.VatRegistrationNumber,
            settings.IsPhase2Enabled,
            settings.CertificateBase64 is not null,
            settings.CertificateExpiryDate,
            settings.InvoiceCounter,
            settings.UpdatedAt);
    }
}
