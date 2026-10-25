using NexusPOS.CRM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Commands.UpdateLoyaltySettings;

public sealed record UpdateLoyaltySettingsCommand(
    Guid TenantId,
    bool Enabled,
    decimal PointsPerCurrencyUnit,
    int RedeemPoints,
    decimal RedeemValue,
    int MinRedeemPoints) : ICommand<LoyaltySettingsResponse>;
