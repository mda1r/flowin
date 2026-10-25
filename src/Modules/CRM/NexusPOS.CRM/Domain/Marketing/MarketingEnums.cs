namespace NexusPOS.CRM.Domain.Marketing;

public enum CampaignChannel
{
    // The owner opens each chat from the page and presses send in WhatsApp.
    Links = 1,

    // Sent by the platform through the store's WhatsApp Business (Cloud) API account.
    Api = 2,
}

public enum CampaignRecipientStatus
{
    Pending = 1,
    Sent = 2,
    Failed = 3,
}
