using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Marketing;

public sealed record GetAudienceQuery(Guid TenantId) : IQuery<AudienceResponse>;

internal sealed class GetAudienceQueryHandler(CrmDbContext db) : IQueryHandler<GetAudienceQuery, AudienceResponse>
{
    public async Task<ErrorOr<AudienceResponse>> Handle(GetAudienceQuery request, CancellationToken cancellationToken)
    {
        var customers = await db.Customers
            .AsNoTracking()
            .Where(c => c.TenantId == request.TenantId && c.IsActive)
            .Select(c => new { c.Id, c.Name, c.Phone, c.MarketingOptIn })
            .ToListAsync(cancellationToken);

        List<AudienceMemberResponse> reachable = [];
        int withoutConsent = 0;
        int withoutPhone = 0;
        foreach (var c in customers)
        {
            string? phone = WhatsAppPhone.Normalize(c.Phone);
            if (!c.MarketingOptIn)
            {
                withoutConsent++;
            }
            else if (phone is null)
            {
                withoutPhone++;
            }
            else
            {
                reachable.Add(new AudienceMemberResponse(c.Id.Value, c.Name, phone));
            }
        }

        return new AudienceResponse([.. reachable.OrderBy(r => r.Name)], withoutConsent, withoutPhone);
    }
}
