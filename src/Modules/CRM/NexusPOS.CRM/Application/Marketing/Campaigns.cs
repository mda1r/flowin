using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Marketing;

public sealed record ListCampaignsQuery(Guid TenantId) : IQuery<IReadOnlyList<CampaignResponse>>;

internal sealed class ListCampaignsQueryHandler(CrmDbContext db)
    : IQueryHandler<ListCampaignsQuery, IReadOnlyList<CampaignResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<CampaignResponse>>> Handle(ListCampaignsQuery request, CancellationToken cancellationToken)
    {
        List<MarketingCampaign> campaigns = await db.MarketingCampaigns
            .AsNoTracking()
            .Include(c => c.Recipients)
            .Where(c => c.TenantId == request.TenantId)
            .OrderByDescending(c => c.CreatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);
        return campaigns.ConvertAll(c => MarketingMapper.ToResponse(c, withRecipients: false));
    }
}

public sealed record GetCampaignQuery(Guid TenantId, Guid CampaignId) : IQuery<CampaignResponse>;

internal sealed class GetCampaignQueryHandler(CrmDbContext db) : IQueryHandler<GetCampaignQuery, CampaignResponse>
{
    public async Task<ErrorOr<CampaignResponse>> Handle(GetCampaignQuery request, CancellationToken cancellationToken)
    {
        MarketingCampaign? campaign = await CampaignLoader.LoadAsync(db, request.TenantId, request.CampaignId, cancellationToken);
        return campaign is null ? MarketingErrors.CampaignNotFound : MarketingMapper.ToResponse(campaign, withRecipients: true);
    }
}

// The owner opened a recipient's chat from the page (links mode) and sent the message there.
public sealed record MarkRecipientSentCommand(Guid TenantId, Guid CampaignId, Guid RecipientId) : ICommand<CampaignResponse>;

internal sealed class MarkRecipientSentCommandHandler(CrmDbContext db) : ICommandHandler<MarkRecipientSentCommand, CampaignResponse>
{
    public async Task<ErrorOr<CampaignResponse>> Handle(MarkRecipientSentCommand request, CancellationToken cancellationToken)
    {
        MarketingCampaign? campaign = await CampaignLoader.LoadAsync(db, request.TenantId, request.CampaignId, cancellationToken);
        if (campaign is null)
        {
            return MarketingErrors.CampaignNotFound;
        }

        if (campaign.Channel != CampaignChannel.Links)
        {
            return MarketingErrors.WrongChannel;
        }

        CampaignRecipient? recipient = campaign.Recipients.FirstOrDefault(r => r.Id == request.RecipientId);
        if (recipient is null)
        {
            return MarketingErrors.RecipientNotFound;
        }

        recipient.MarkSent(null);
        await db.SaveChangesAsync(cancellationToken);
        return MarketingMapper.ToResponse(campaign, withRecipients: true);
    }
}

// Puts failed recipients back in the queue, for after the owner fixed the template or the token.
public sealed record RetryFailedCommand(Guid TenantId, Guid CampaignId) : ICommand<CampaignResponse>;

internal sealed class RetryFailedCommandHandler(CrmDbContext db) : ICommandHandler<RetryFailedCommand, CampaignResponse>
{
    public async Task<ErrorOr<CampaignResponse>> Handle(RetryFailedCommand request, CancellationToken cancellationToken)
    {
        MarketingCampaign? campaign = await CampaignLoader.LoadAsync(db, request.TenantId, request.CampaignId, cancellationToken);
        if (campaign is null)
        {
            return MarketingErrors.CampaignNotFound;
        }

        foreach (CampaignRecipient r in campaign.Recipients)
        {
            r.Retry();
        }

        await db.SaveChangesAsync(cancellationToken);
        return MarketingMapper.ToResponse(campaign, withRecipients: true);
    }
}

internal static class CampaignLoader
{
    public static Task<MarketingCampaign?> LoadAsync(CrmDbContext db, Guid tenantId, Guid campaignId, CancellationToken ct) =>
        db.MarketingCampaigns
            .Include(c => c.Recipients)
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.TenantId == tenantId, ct);
}
