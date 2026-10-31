using System.Buffers.Binary;
using System.Text.Json;
using FluentAssertions;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Infrastructure.WhatsApp;

namespace NexusPOS.CRM.UnitTests.Domain;

public sealed class WhatsAppSendingTests
{
    private static readonly Guid _tenant = Guid.NewGuid();

    private static MarketingCampaign Campaign() =>
        MarketingCampaign.Create(_tenant, "عرض", null, CampaignChannel.Api, null, [(Guid.NewGuid(), "سارة", "966551234567")]).Value;

    private static WhatsAppSettings Settings(bool image = true, bool name = true)
    {
        WhatsAppSettings settings = WhatsAppSettings.Create(_tenant);
        settings.Update("1234567890", "token-abcd", "weekly_offer", "ar", image, name, "998877");
        return settings;
    }

    [Fact]
    public void Lease_IsFree_ForTheSamePage_OrOnceItRunsOut_ButNotForAnotherPage()
    {
        MarketingCampaign campaign = Campaign();
        Guid first = Guid.NewGuid();
        Guid second = Guid.NewGuid();
        DateTime now = DateTime.UtcNow;

        MarketingCampaign.ClaimableBy(first, now).Compile()(campaign).Should().BeTrue("nobody is sending yet");

        // What the database UPDATE writes when the first page claims it.
        typeof(MarketingCampaign).GetProperty(nameof(MarketingCampaign.SendingRunnerId))!.SetValue(campaign, first);
        typeof(MarketingCampaign).GetProperty(nameof(MarketingCampaign.SendingLeaseUntil))!.SetValue(campaign, now + MarketingCampaign.SendingLease);

        MarketingCampaign.ClaimableBy(first, now).Compile()(campaign).Should().BeTrue("the same page keeps sending");
        MarketingCampaign.ClaimableBy(second, now).Compile()(campaign).Should().BeFalse("another tab must wait");
        campaign.ActiveRunner(now).Should().Be(first);

        DateTime later = now + MarketingCampaign.SendingLease + TimeSpan.FromSeconds(1);
        MarketingCampaign.ClaimableBy(second, later).Compile()(campaign).Should().BeTrue("a closed tab frees it in time");
        campaign.ActiveRunner(later).Should().BeNull();
    }

    [Theory]
    [InlineData(190, WhatsAppFailure.Campaign, "التوكن")]
    [InlineData(132001, WhatsAppFailure.Campaign, "القالب")]
    [InlineData(132000, WhatsAppFailure.Campaign, "متغيرات")]
    [InlineData(131042, WhatsAppFailure.Campaign, "الدفع")]
    [InlineData(130429, WhatsAppFailure.Campaign, "حد الإرسال")]
    [InlineData(131026, WhatsAppFailure.Recipient, "غير مسجّل في واتساب")]
    [InlineData(131049, WhatsAppFailure.Recipient, "Meta تحدّ")]
    [InlineData(131047, WhatsAppFailure.Recipient, "٢٤ ساعة")]
    public void MetaErrors_StopTheCampaign_OnlyWhenEveryoneWouldFail(int code, WhatsAppFailure expected, string reason)
    {
        WhatsAppSendResult result = WhatsAppErrors.Describe(400, code, null, "(#" + code + ") English text");

        result.Ok.Should().BeFalse();
        result.Failure.Should().Be(expected);
        result.StopsCampaign.Should().Be(expected == WhatsAppFailure.Campaign);
        result.Error.Should().Contain(reason).And.Contain(code.ToString(System.Globalization.CultureInfo.InvariantCulture))
            .And.NotContain("English text");
    }

    [Fact]
    public void MetaErrors_WrongPhoneId_AndUnknownCodes()
    {
        WhatsAppErrors.Describe(400, 100, 33, "Object does not exist").Error.Should().Contain("معرّف رقم الهاتف");
        WhatsAppErrors.Describe(401, null, null, null).Failure.Should().Be(WhatsAppFailure.Campaign);
        WhatsAppErrors.Describe(403, 210, null, null).Failure.Should().Be(WhatsAppFailure.Campaign);

        WhatsAppSendResult unknown = WhatsAppErrors.Describe(400, 999999, null, "Something odd");
        unknown.Failure.Should().Be(WhatsAppFailure.Recipient);
        unknown.Error.Should().Be("رفض واتساب الرسالة: Something odd (999999)");
    }

    [Fact]
    public void ParseError_ReadsTheCodeFromMetasBody()
    {
        using JsonDocument body = JsonDocument.Parse("""
            {"error":{"message":"(#132001) Template name does not exist in the translation","type":"OAuthException","code":132001,
             "error_data":{"messaging_product":"whatsapp","details":"template name (weekly) does not exist in ar"}}}
            """);

        WhatsAppSendResult result = WhatsAppCloudClient.ParseError(404, body.RootElement);

        result.Failure.Should().Be(WhatsAppFailure.Campaign);
        result.Error.Should().StartWith("القالب غير موجود");
    }

    private static (WhatsAppCheckItem Item, string? Body) Analyze(WhatsAppSettings settings, string templatesJson)
    {
        using JsonDocument doc = JsonDocument.Parse(templatesJson);
        return WhatsAppCloudClient.AnalyzeTemplates(doc.RootElement.Clone(), settings);
    }

    private const string Approved = """
        [{"name":"weekly_offer","language":"en_US","status":"APPROVED","components":[]},
         {"name":"weekly_offer","language":"ar","status":"APPROVED","category":"MARKETING","components":[
           {"type":"HEADER","format":"IMAGE"},
           {"type":"BODY","text":"مرحباً {{1}}، {{2}}"},
           {"type":"BUTTONS","buttons":[{"type":"URL","text":"اطلب","url":"https://example.com/menu"}]}]}]
        """;

    [Fact]
    public void Template_ThatMatchesTheSettings_PassesAndReturnsItsBody()
    {
        (WhatsAppCheckItem item, string? body) = Analyze(Settings(), Approved);

        item.Status.Should().Be(WhatsAppCheckStatus.Ok);
        item.Detail.Should().Contain("تسويقي");
        body.Should().Be("مرحباً {{1}}، {{2}}");
    }

    [Fact]
    public void Template_Problems_AreSpelledOut()
    {
        Analyze(Settings(), "[]").Item.Detail.Should().Contain("لا يوجد قالب");
        Analyze(Settings(name: false), Approved).Item.Detail.Should().Contain("متغيراً واحداً");
        Analyze(Settings(image: false), Approved).Item.Detail.Should().Contain("فعّل خيار الصورة");

        Analyze(Settings(), """[{"name":"weekly_offer","language":"en_US","status":"APPROVED","components":[]}]""")
            .Item.Detail.Should().Contain("en_US");
        Analyze(Settings(), """[{"name":"weekly_offer","language":"ar","status":"PENDING","components":[]}]""")
            .Item.Detail.Should().Contain("قيد المراجعة");
        Analyze(Settings(image: false), """
            [{"name":"weekly_offer","language":"ar","status":"APPROVED","components":[{"type":"BODY","text":"هلا {{name}} {{offer}}"}]}]
            """).Item.Detail.Should().Contain("بأسماء");

        (WhatsAppCheckItem wrongCount, string? body) = Analyze(Settings(image: false), """
            [{"name":"weekly_offer","language":"ar","status":"APPROVED","components":[{"type":"BODY","text":"{{1}}"}]}]
            """);
        wrongCount.Status.Should().Be(WhatsAppCheckStatus.Failed);
        body.Should().Be("{{1}}");
    }

    [Fact]
    public void Settings_ForgetTheTemplateText_WhenTheTemplateChanges()
    {
        WhatsAppSettings settings = Settings();
        settings.RememberTemplateBody("مرحباً {{1}}، {{2}}");

        settings.Update("1234567890", null, "weekly_offer", "ar", true, true, "998877");
        settings.TemplateBody.Should().Be("مرحباً {{1}}، {{2}}");

        settings.Update("1234567890", null, "eid_offer", "ar", true, true, "998877");
        settings.TemplateBody.Should().BeNull();
        settings.BusinessAccountId.Should().Be("998877");
    }

    [Fact]
    public void PlaceholderImage_IsAValidPng()
    {
        byte[] png = PlaceholderImage.Png;

        png[..8].Should().Equal(137, 80, 78, 71, 13, 10, 26, 10);
        System.Text.Encoding.ASCII.GetString(png, 12, 4).Should().Be("IHDR");
        BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(16)).Should().Be(400);
        BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(20)).Should().Be(400);
        png.Length.Should().BeLessThan(MarketingMedia.MaxBytes);
    }
}
