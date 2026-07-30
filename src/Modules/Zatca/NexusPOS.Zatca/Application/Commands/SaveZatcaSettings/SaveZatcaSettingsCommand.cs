using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Zatca.Application.Common;

namespace NexusPOS.Zatca.Application.Commands.SaveZatcaSettings;

public sealed record SaveZatcaSettingsCommand(
    Guid TenantId,
    string SellerName,
    string VatRegistrationNumber,
    bool IsPhase2Enabled,
    string? CertificateBase64,
    DateTime? CertificateExpiryDate) : ICommand<ZatcaSettingsResponse>;
