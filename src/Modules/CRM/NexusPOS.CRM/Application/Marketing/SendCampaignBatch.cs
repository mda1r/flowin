using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.CRM.Infrastructure.WhatsApp;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Marketing;

// Sends the next few waiting recipients through the WhatsApp Business API. The page calls this repeatedly and
// shows progress; everything already sent is saved, so closing the page only pauses the campaign.
public sealed record SendCampaignBatchCommand(Guid TenantId, Guid CampaignId) : ICommand<CampaignResponse>;

internal sealed class SendCampaignBatchCommandHandler(CrmDbContext db, IWhatsAppSender whatsApp)
    : ICommandHandler<SendCampaignBatchCommand, CampaignResponse>
{
    public const int BatchSize = 10;

    public async Task<ErrorOr<CampaignResponse>> Handle(SendCampaignBatchCommand request, CancellationToken cancellationToken)
    {
        MarketingCampaign? campaign = await CampaignLoader.LoadAsync(db, request.TenantId, request.CampaignId, cancellationToken);
        if (campaign is null)
        {
            return MarketingErrors.CampaignNotFound;
        }

        if (campaign.Channel != CampaignChannel.Api)
        {
            return MarketingErrors.WrongChannel;
        }

        WhatsAppSettings? settings = await db.WhatsAppSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);
        if (settings is null || !settings.IsConfigured)
        {
            return MarketingErrors.ApiNotConfigured;
        }

        IReadOnlyList<CampaignRecipient> batch = campaign.NextPending(BatchSize);
        if (batch.Count == 0)
        {
            return MarketingMapper.ToResponse(campaign, withRecipients: true);
        }

        if (settings.HasImageHeader && campaign.WhatsAppMediaId is null)
        {
            if (campaign.ImageId is not Guid imageId)
            {
                return MarketingErrors.ImageRequiredByTemplate;
            }

            MarketingMedia? image = await db.MarketingMedia.AsNoTracking().FirstOrDefaultAsync(m => m.Id == imageId, cancellationToken);
            if (image is null)
            {
                return MarketingErrors.MediaNotFound;
            }

            WhatsAppSendResult uploaded = await whatsApp.UploadImageAsync(settings, image, cancellationToken);
            if (!uploaded.Ok || uploaded.MessageId is null)
            {
                // Without the image nothing in this campaign can go out; report it and keep everyone waiting.
                return ErrorOr.Error.Failure("Marketing.ImageUploadFailed", "لم يقبل واتساب صورة الحملة: " + uploaded.Error);
            }

            campaign.UseWhatsAppMedia(uploaded.MessageId);
            await db.SaveChangesAsync(cancellationToken);
        }

        foreach (CampaignRecipient recipient in batch)
        {
            WhatsAppSendResult sent = await whatsApp.SendTemplateAsync(
                settings, recipient.Phone, recipient.Name, campaign.PersonalizedFor(recipient), campaign.WhatsAppMediaId, cancellationToken);
            if (sent.Ok)
            {
                recipient.MarkSent(sent.MessageId);
            }
            else
            {
                recipient.MarkFailed(sent.Error ?? "error");
            }

            await db.SaveChangesAsync(cancellationToken);
        }

        return MarketingMapper.ToResponse(campaign, withRecipients: true);
    }
}
