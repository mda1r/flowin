using ErrorOr;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Application.Services;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.CRM.Application.Queries.GetLoyaltySettings;

internal sealed class GetLoyaltySettingsQueryHandler(CrmDbContext db)
    : IQueryHandler<GetLoyaltySettingsQuery, LoyaltySettingsResponse>
{
    public async Task<ErrorOr<LoyaltySettingsResponse>> Handle(GetLoyaltySettingsQuery request, CancellationToken cancellationToken)
    {
        LoyaltyRules rules = await CustomerLoyaltyDirectory.LoadRulesAsync(db, request.TenantId, cancellationToken);
        return LoyaltySettingsMapper.ToResponse(rules);
    }
}
