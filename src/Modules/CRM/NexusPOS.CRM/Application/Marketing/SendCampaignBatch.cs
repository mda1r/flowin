using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.CRM.Infrastructure.WhatsApp;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Marketing;

// Sends the next few waiting recipients through the WhatsApp Business API. The page calls this repeatedly and
// shows progress; everything already sent is saved, so closing the page only pauses the campaign.
// RunnerId identifies the sending page: while it holds the lease no other tab or device can send this campaign.
// Without one (an older page) the call gets a lease of its own that ends with the batch.
public sealed record SendCampaignBatchCommand(Guid TenantId, Guid CampaignId, Guid? RunnerId = null) : ICommand<CampaignResponse>;

internal sealed class SendCampaignBatchCommandHandler(CrmDbContext db, IWhatsAppSender whatsApp)
    : ICommandHandler<SendCampaignBatchCommand, CampaignResponse>
{
    public const int BatchSize = 10;

    public async Task<ErrorOr<CampaignResponse>> Handle(SendCampaignBatchCommand request, CancellationToken cancellationToken)
    {
        Guid runnerId = request.RunnerId ?? Guid.NewGuid();

        // Claim first, then read: the recipients loaded below are the ones nobody else can be sending.
        bool claimed = await CampaignSendingLease.TryClaimAsync(db, request.TenantId, request.CampaignId, runnerId, cancellationToken);
        MarketingCampaign? campaign = await CampaignLoader.LoadAsync(db, request.TenantId, request.CampaignId, cancellationToken);
        if (campaign is null)
        {
            return MarketingErrors.CampaignNotFound;
        }

        if (!claimed)
        {
            return MarketingErrors.SendingElsewhere;
        }

        ErrorOr<Success> sent = await SendNextAsync(campaign, request.TenantId, runnerId, cancellationToken);

        // Keep the lease while there is more to send so the page's next call continues; free it otherwise.
        if (sent.IsError || request.RunnerId is null || campaign.NextPending(1).Count == 0)
        {
            await CampaignSendingLease.ReleaseAsync(db, request.TenantId, request.CampaignId, runnerId, CancellationToken.None);
        }

        return sent.IsError ? sent.Errors : MarketingMapper.ToResponse(campaign, withRecipients: true);
    }

    private async Task<ErrorOr<Success>> SendNextAsync(MarketingCampaign campaign, Guid tenantId, Guid runnerId, CancellationToken ct)
    {
        if (campaign.Channel != CampaignChannel.Api)
        {
            return MarketingErrors.WrongChannel;
        }

        WhatsAppSettings? settings = await db.WhatsAppSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);
        if (settings is null || !settings.IsConfigured)
        {
            return MarketingErrors.ApiNotConfigured;
        }

        IReadOnlyList<CampaignRecipient> batch = campaign.NextPending(BatchSize);
        if (batch.Count == 0)
        {
            return Result.Success;
        }

        if (settings.HasImageHeader && campaign.WhatsAppMediaId is null)
        {
            if (campaign.ImageId is not Guid imageId)
            {
                return MarketingErrors.ImageRequiredByTemplate;
            }

            MarketingMedia? image = await db.MarketingMedia.AsNoTracking().FirstOrDefaultAsync(m => m.Id == imageId, ct);
            if (image is null)
            {
                return MarketingErrors.MediaNotFound;
            }

            WhatsAppSendResult uploaded = await whatsApp.UploadImageAsync(settings, image, ct);
            if (!uploaded.Ok || uploaded.MessageId is null)
            {
                // Without the image nothing in this campaign can go out; report it and keep everyone waiting.
                return MarketingErrors.SendStopped("لم يقبل واتساب صورة الحملة: " + uploaded.Error);
            }

            campaign.UseWhatsAppMedia(uploaded.MessageId);
            await db.SaveChangesAsync(ct);
        }

        foreach (CampaignRecipient recipient in batch)
        {
            // Renewed before every message, so the lease never runs out while this page is still sending.
            if (!await CampaignSendingLease.TryClaimAsync(db, tenantId, campaign.Id, runnerId, ct))
            {
                return MarketingErrors.SendingElsewhere;
            }

            WhatsAppSendResult sent = await whatsApp.SendTemplateAsync(
                settings, recipient.Phone, recipient.Name, campaign.PersonalizedFor(recipient), campaign.WhatsAppMediaId, ct);
            if (sent.Ok)
            {
                recipient.MarkSent(sent.MessageId);
            }
            else if (sent.Failure == WhatsAppFailure.Campaign)
            {
                // The account or template is at fault: nobody else would get through either, so they stay waiting.
                return MarketingErrors.SendStopped(sent.Error);
            }
            else
            {
                recipient.MarkFailed(sent.Error ?? "error");
            }

            await db.SaveChangesAsync(ct);
            if (sent.Failure == WhatsAppFailure.Connection)
            {
                // This one may have arrived, so it is marked failed (the owner checks before retrying); stop the rest.
                return MarketingErrors.SendStopped(sent.Error);
            }
        }

        return Result.Success;
    }
}

// Releases the lease when the page pauses or closes, so another device can carry on straight away.
public sealed record ReleaseCampaignSendingCommand(Guid TenantId, Guid CampaignId, Guid RunnerId) : ICommand<Success>;

internal sealed class ReleaseCampaignSendingCommandHandler(CrmDbContext db) : ICommandHandler<ReleaseCampaignSendingCommand, Success>
{
    public async Task<ErrorOr<Success>> Handle(ReleaseCampaignSendingCommand request, CancellationToken cancellationToken)
    {
        await CampaignSendingLease.ReleaseAsync(db, request.TenantId, request.CampaignId, request.RunnerId, cancellationToken);
        return Result.Success;
    }
}

internal static class CampaignSendingLease
{
    // One UPDATE: when two pages ask at once, the database lets only one of them change the row.
    public static async Task<bool> TryClaimAsync(CrmDbContext db, Guid tenantId, Guid campaignId, Guid runnerId, CancellationToken ct)
    {
        DateTime now = DateTime.UtcNow;
        DateTime? until = now + MarketingCampaign.SendingLease;
        Guid? runner = runnerId;
        int claimed = await db.MarketingCampaigns
            .Where(c => c.Id == campaignId && c.TenantId == tenantId)
            .Where(MarketingCampaign.ClaimableBy(runnerId, now))
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.SendingRunnerId, runner).SetProperty(c => c.SendingLeaseUntil, until), ct);
        return claimed == 1;
    }

    public static Task ReleaseAsync(CrmDbContext db, Guid tenantId, Guid campaignId, Guid runnerId, CancellationToken ct) =>
        db.MarketingCampaigns
            .Where(c => c.Id == campaignId && c.TenantId == tenantId && c.SendingRunnerId == runnerId)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.SendingRunnerId, (Guid?)null).SetProperty(c => c.SendingLeaseUntil, (DateTime?)null), ct);
}
