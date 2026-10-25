using System.Text.Json;
using FluentAssertions;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Infrastructure.WhatsApp;

namespace NexusPOS.CRM.UnitTests.Domain;

public sealed class MarketingCampaignTests
{
    private static readonly Guid _tenant = Guid.NewGuid();

    private static List<(Guid, string, string)> People(int count) =>
        [.. Enumerable.Range(1, count).Select(i => (Guid.NewGuid(), $"عميل {i}", $"96650000{i:D4}"))];

    [Theory]
    [InlineData("0551234567", "966551234567")]
    [InlineData("551234567", "966551234567")]
    [InlineData("+966 55 123 4567", "966551234567")]
    [InlineData("00966551234567", "966551234567")]
    [InlineData("+20 100 123 4567", "201001234567")]
    [InlineData("12345", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void Phone_IsNormalizedLikeTheTill(string? input, string? expected) =>
        WhatsAppPhone.Normalize(input).Should().Be(expected);

    [Fact]
    public void Create_NeedsTextOrImage_AndSomeoneToSendTo()
    {
        MarketingCampaign.Create(_tenant, "  ", null, CampaignChannel.Links, null, People(1))
            .FirstError.Should().Be(MarketingErrors.EmptyMessage);
        MarketingCampaign.Create(_tenant, "عرض", null, CampaignChannel.Links, null, People(0))
            .FirstError.Should().Be(MarketingErrors.NoRecipients);
        MarketingCampaign.Create(_tenant, new string('x', MarketingCampaign.MaxMessageLength + 1), null, CampaignChannel.Links, null, People(1))
            .FirstError.Should().Be(MarketingErrors.MessageTooLong);
        MarketingCampaign.Create(_tenant, "", Guid.NewGuid(), CampaignChannel.Links, null, People(1))
            .IsError.Should().BeFalse();
    }

    [Fact]
    public void Message_IsPersonalizedWithTheRecipientsName()
    {
        MarketingCampaign campaign = MarketingCampaign.Create(
            _tenant, "هلا {الاسم}، خصم 20% اليوم يا {الاسم}", null, CampaignChannel.Api, null,
            [(Guid.NewGuid(), "سارة", "966551234567")]).Value;

        campaign.PersonalizedFor(campaign.Recipients[0]).Should().Be("هلا سارة، خصم 20% اليوم يا سارة");
    }

    [Fact]
    public void NextPending_ResumesWhereSendingStopped_AndFailedCanBeRetried()
    {
        MarketingCampaign campaign = MarketingCampaign.Create(_tenant, "عرض", null, CampaignChannel.Api, null, People(25)).Value;

        foreach (CampaignRecipient r in campaign.NextPending(10))
        {
            r.MarkSent("wamid.x");
        }

        IReadOnlyList<CampaignRecipient> second = campaign.NextPending(10);
        second.Should().HaveCount(10).And.OnlyContain(r => r.Status == CampaignRecipientStatus.Pending);
        second[0].MarkFailed("Template not approved");

        campaign.NextPending(100).Should().HaveCount(14);
        campaign.Recipients.Single(r => r.Status == CampaignRecipientStatus.Failed).Retry();
        campaign.NextPending(100).Should().HaveCount(15);
    }

    [Fact]
    public void TemplateText_HasNoLineBreaksOrLongSpaces()
    {
        WhatsAppCloudClient.ToTemplateText("خصم 20%\n\nعلى كل المشروبات\t     اليوم فقط")
            .Should().Be("خصم 20% · على كل المشروبات · اليوم فقط");
    }

    [Fact]
    public void TemplatePayload_PutsTheImageInTheHeader_AndNameBeforeTheOffer()
    {
        WhatsAppSettings settings = WhatsAppSettings.Create(_tenant);
        settings.Update("1234567890", "token-abcd", "weekly_offer", "ar", hasImageHeader: true, includeNameVariable: true);

        string json = JsonSerializer.Serialize(
            WhatsAppCloudClient.BuildTemplatePayload(settings, "966551234567", "سارة", "خصم 20%", "media-1"));
        using JsonDocument doc = JsonDocument.Parse(json);
        JsonElement template = doc.RootElement.GetProperty("template");

        doc.RootElement.GetProperty("to").GetString().Should().Be("966551234567");
        template.GetProperty("name").GetString().Should().Be("weekly_offer");
        JsonElement components = template.GetProperty("components");
        components[0].GetProperty("type").GetString().Should().Be("header");
        components[0].GetProperty("parameters")[0].GetProperty("image").GetProperty("id").GetString().Should().Be("media-1");
        JsonElement body = components[1].GetProperty("parameters");
        body[0].GetProperty("text").GetString().Should().Be("سارة");
        body[1].GetProperty("text").GetString().Should().Be("خصم 20%");
    }

    [Fact]
    public void Settings_KeepTheSavedToken_WhenTheFormLeavesItBlank()
    {
        WhatsAppSettings settings = WhatsAppSettings.Create(_tenant);
        settings.Update("123", "secret-token-9876", "offer", "ar", false, false);
        settings.Update("123", "", "offer_v2", "ar", false, false);

        settings.AccessToken.Should().Be("secret-token-9876");
        settings.TokenHint.Should().Be("…9876");
        settings.IsConfigured.Should().BeTrue();
    }
}
