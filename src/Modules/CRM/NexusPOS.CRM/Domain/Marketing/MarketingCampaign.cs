using ErrorOr;

namespace NexusPOS.CRM.Domain.Marketing;

// One offer sent to a chosen list of customers who agreed to receive offers.
public sealed class MarketingCampaign
{
    public const int MaxMessageLength = 1000;
    public const int MaxRecipients = 2000;

    private readonly List<CampaignRecipient> _recipients = [];

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string Message { get; private set; } = string.Empty;
    public Guid? ImageId { get; private set; }
    public CampaignChannel Channel { get; private set; }
    public Guid? CreatedByUserId { get; private set; }
    public DateTime CreatedAt { get; private set; }

    // The image uploaded once to WhatsApp for this campaign, reused for every recipient.
    public string? WhatsAppMediaId { get; private set; }

    public IReadOnlyList<CampaignRecipient> Recipients => _recipients;

    private MarketingCampaign() { }

    public static ErrorOr<MarketingCampaign> Create(
        Guid tenantId,
        string message,
        Guid? imageId,
        CampaignChannel channel,
        Guid? createdByUserId,
        IReadOnlyCollection<(Guid CustomerId, string Name, string Phone)> recipients)
    {
        string text = message.Trim();
        if (text.Length == 0 && imageId is null)
        {
            return MarketingErrors.EmptyMessage;
        }

        if (text.Length > MaxMessageLength)
        {
            return MarketingErrors.MessageTooLong;
        }

        if (recipients.Count == 0)
        {
            return MarketingErrors.NoRecipients;
        }

        if (recipients.Count > MaxRecipients)
        {
            return MarketingErrors.TooManyRecipients;
        }

        MarketingCampaign campaign = new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Message = text,
            ImageId = imageId,
            Channel = channel,
            CreatedByUserId = createdByUserId,
            CreatedAt = DateTime.UtcNow,
        };
        foreach ((Guid customerId, string name, string phone) in recipients)
        {
            campaign._recipients.Add(CampaignRecipient.Create(campaign.Id, customerId, name, phone));
        }

        return campaign;
    }

    public void UseWhatsAppMedia(string mediaId) => WhatsAppMediaId = mediaId;

    // The next recipients still waiting, oldest first, so an interrupted send resumes where it stopped.
    public IReadOnlyList<CampaignRecipient> NextPending(int count) =>
        [.. _recipients.Where(r => r.Status == CampaignRecipientStatus.Pending).Take(count)];

    // The message as one recipient reads it: {الاسم} becomes their name.
    public string PersonalizedFor(CampaignRecipient recipient) =>
        Message.Replace(NamePlaceholder, recipient.Name, StringComparison.Ordinal);

    public const string NamePlaceholder = "{الاسم}";
}

public sealed class CampaignRecipient
{
    public Guid Id { get; private set; }
    public Guid CampaignId { get; private set; }
    public Guid CustomerId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public CampaignRecipientStatus Status { get; private set; }
    public string? Error { get; private set; }
    public string? ProviderMessageId { get; private set; }
    public DateTime? SentAt { get; private set; }

    private CampaignRecipient() { }

    internal static CampaignRecipient Create(Guid campaignId, Guid customerId, string name, string phone) => new()
    {
        Id = Guid.NewGuid(),
        CampaignId = campaignId,
        CustomerId = customerId,
        Name = name,
        Phone = phone,
        Status = CampaignRecipientStatus.Pending,
    };

    public void MarkSent(string? providerMessageId)
    {
        Status = CampaignRecipientStatus.Sent;
        ProviderMessageId = providerMessageId;
        Error = null;
        SentAt = DateTime.UtcNow;
    }

    public void MarkFailed(string error)
    {
        Status = CampaignRecipientStatus.Failed;
        Error = error.Length > 300 ? error[..300] : error;
    }

    // Lets the owner try a failed recipient again after fixing the cause.
    public void Retry()
    {
        if (Status == CampaignRecipientStatus.Failed)
        {
            Status = CampaignRecipientStatus.Pending;
            Error = null;
        }
    }
}
