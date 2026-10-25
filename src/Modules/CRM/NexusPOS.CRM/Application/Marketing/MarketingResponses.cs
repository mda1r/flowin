using NexusPOS.CRM.Domain.Marketing;

namespace NexusPOS.CRM.Application.Marketing;

public sealed record AudienceMemberResponse(Guid CustomerId, string Name, string Phone);

// Who a campaign can reach, plus how many customers are left out and why, so the owner knows what to fix.
public sealed record AudienceResponse(
    IReadOnlyList<AudienceMemberResponse> Reachable,
    int WithoutConsent,
    int WithoutValidPhone);

public sealed record MediaResponse(Guid Id, string Path);

public sealed record CampaignRecipientResponse(
    Guid Id, Guid CustomerId, string Name, string Phone, CampaignRecipientStatus Status, string? Error, DateTime? SentAt);

public sealed record CampaignResponse(
    Guid Id,
    string Message,
    string? ImagePath,
    CampaignChannel Channel,
    DateTime CreatedAt,
    int Total,
    int Sent,
    int Failed,
    IReadOnlyList<CampaignRecipientResponse>? Recipients);

public sealed record WhatsAppSettingsResponse(
    bool Configured,
    string PhoneNumberId,
    string? TokenHint,
    string TemplateName,
    string LanguageCode,
    bool HasImageHeader,
    bool IncludeNameVariable);

internal static class MarketingMapper
{
    public static string MediaPath(Guid id) => $"/api/v1/public/media/{id}";

    public static CampaignResponse ToResponse(MarketingCampaign c, bool withRecipients) => new(
        c.Id,
        c.Message,
        c.ImageId is Guid img ? MediaPath(img) : null,
        c.Channel,
        c.CreatedAt,
        c.Recipients.Count,
        c.Recipients.Count(r => r.Status == CampaignRecipientStatus.Sent),
        c.Recipients.Count(r => r.Status == CampaignRecipientStatus.Failed),
        withRecipients
            ? [.. c.Recipients.OrderBy(r => r.Name).Select(r =>
                new CampaignRecipientResponse(r.Id, r.CustomerId, r.Name, r.Phone, r.Status, r.Error, r.SentAt))]
            : null);

    public static WhatsAppSettingsResponse ToResponse(WhatsAppSettings? s) => s is null
        ? new(false, string.Empty, null, string.Empty, "ar", false, false)
        : new(s.IsConfigured, s.PhoneNumberId, s.TokenHint, s.TemplateName, s.LanguageCode, s.HasImageHeader, s.IncludeNameVariable);
}
