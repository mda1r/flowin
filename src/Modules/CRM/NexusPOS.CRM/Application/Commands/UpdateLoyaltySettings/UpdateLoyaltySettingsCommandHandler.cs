using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.CRM.Application.Commands.UpdateLoyaltySettings;

internal sealed class UpdateLoyaltySettingsCommandHandler(CrmDbContext db)
    : ICommandHandler<UpdateLoyaltySettingsCommand, LoyaltySettingsResponse>
{
    public async Task<ErrorOr<LoyaltySettingsResponse>> Handle(UpdateLoyaltySettingsCommand request, CancellationToken cancellationToken)
    {
        LoyaltySettings? settings = await db.LoyaltySettings
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);
        if (settings is null)
        {
            settings = LoyaltySettings.Create(request.TenantId);
            db.LoyaltySettings.Add(settings);
        }

        LoyaltyRules rules = new(
            request.Enabled, request.PointsPerCurrencyUnit, request.RedeemPoints, request.RedeemValue, request.MinRedeemPoints);
        settings.Update(rules);
        await db.SaveChangesAsync(cancellationToken);

        return LoyaltySettingsMapper.ToResponse(rules);
    }
}
