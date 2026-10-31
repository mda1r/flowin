using ErrorOr;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.CRM.Infrastructure.WhatsApp;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Marketing;

public sealed record GetWhatsAppSettingsQuery(Guid TenantId) : IQuery<WhatsAppSettingsResponse>;

internal sealed class GetWhatsAppSettingsQueryHandler(CrmDbContext db) : IQueryHandler<GetWhatsAppSettingsQuery, WhatsAppSettingsResponse>
{
    public async Task<ErrorOr<WhatsAppSettingsResponse>> Handle(GetWhatsAppSettingsQuery request, CancellationToken cancellationToken)
    {
        WhatsAppSettings? settings = await db.WhatsAppSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);
        return MarketingMapper.ToResponse(settings);
    }
}

// A blank token keeps the one already saved, so the page never needs to read it back.
public sealed record UpdateWhatsAppSettingsCommand(
    Guid TenantId,
    string PhoneNumberId,
    string? AccessToken,
    string TemplateName,
    string LanguageCode,
    bool HasImageHeader,
    bool IncludeNameVariable,
    string? BusinessAccountId = null) : ICommand<WhatsAppSettingsResponse>;

internal sealed class UpdateWhatsAppSettingsCommandValidator : AbstractValidator<UpdateWhatsAppSettingsCommand>
{
    public UpdateWhatsAppSettingsCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.PhoneNumberId).NotEmpty().MaximumLength(64).Matches("^[0-9]+$")
            .WithMessage("معرّف رقم الهاتف (Phone number ID) أرقام فقط، تجده في لوحة WhatsApp Manager.");
        RuleFor(x => x.AccessToken).MaximumLength(1024);
        RuleFor(x => x.TemplateName).NotEmpty().MaximumLength(256).Matches("^[a-z0-9_]+$")
            .WithMessage("اسم القالب كما هو في Meta: أحرف إنجليزية صغيرة وأرقام و _ فقط.");
        RuleFor(x => x.LanguageCode).NotEmpty().MaximumLength(16);
        RuleFor(x => x.BusinessAccountId).MaximumLength(64).Matches("^[0-9]*$")
            .WithMessage("معرّف حساب واتساب للأعمال (WABA ID) أرقام فقط.");
    }
}

internal sealed class UpdateWhatsAppSettingsCommandHandler(CrmDbContext db)
    : ICommandHandler<UpdateWhatsAppSettingsCommand, WhatsAppSettingsResponse>
{
    public async Task<ErrorOr<WhatsAppSettingsResponse>> Handle(UpdateWhatsAppSettingsCommand request, CancellationToken cancellationToken)
    {
        WhatsAppSettings? settings = await db.WhatsAppSettings
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);
        if (settings is null)
        {
            settings = WhatsAppSettings.Create(request.TenantId);
            db.WhatsAppSettings.Add(settings);
        }

        settings.Update(
            request.PhoneNumberId, request.AccessToken, request.TemplateName, request.LanguageCode,
            request.HasImageHeader, request.IncludeNameVariable, request.BusinessAccountId);
        await db.SaveChangesAsync(cancellationToken);
        return MarketingMapper.ToResponse(settings);
    }
}

// Asks Meta about the saved number, token and template without messaging anyone, so a wrong setting shows up
// now and not halfway through a campaign. The template's text is kept for the campaign preview.
public sealed record CheckWhatsAppCommand(Guid TenantId) : ICommand<WhatsAppCheckResponse>;

internal sealed class CheckWhatsAppCommandHandler(CrmDbContext db, IWhatsAppSender whatsApp)
    : ICommandHandler<CheckWhatsAppCommand, WhatsAppCheckResponse>
{
    public async Task<ErrorOr<WhatsAppCheckResponse>> Handle(CheckWhatsAppCommand request, CancellationToken cancellationToken)
    {
        WhatsAppSettings? settings = await db.WhatsAppSettings
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);
        if (settings is null || !settings.IsConfigured)
        {
            return MarketingErrors.ApiNotConfigured;
        }

        WhatsAppCheckResult result = await whatsApp.CheckAsync(settings, cancellationToken);
        if (result.TemplateBody is not null && result.TemplateBody != settings.TemplateBody)
        {
            settings.RememberTemplateBody(result.TemplateBody);
            await db.SaveChangesAsync(cancellationToken);
        }

        return new WhatsAppCheckResponse(
            result.Ok, result.DisplayPhoneNumber, settings.TemplateBody,
            [.. result.Items.Select(i => new WhatsAppCheckItemResponse(i.Label, i.Status.ToString(), i.Detail))]);
    }
}

// Sends the template once to the owner's own phone: the offer being written, or a sample when none is given.
public sealed record SendWhatsAppTestCommand(Guid TenantId, string Phone, string? Name, string? Message, Guid? ImageId)
    : ICommand<WhatsAppTestResponse>;

internal sealed class SendWhatsAppTestCommandValidator : AbstractValidator<SendWhatsAppTestCommand>
{
    public SendWhatsAppTestCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(32);
        RuleFor(x => x.Name).MaximumLength(256);
        RuleFor(x => x.Message).MaximumLength(MarketingCampaign.MaxMessageLength);
    }
}

internal sealed class SendWhatsAppTestCommandHandler(CrmDbContext db, IWhatsAppSender whatsApp)
    : ICommandHandler<SendWhatsAppTestCommand, WhatsAppTestResponse>
{
    public const string SampleMessage = "هذه رسالة تجريبية من نظام الكاشير، العروض ستصل لعملائك بهذا الشكل.";

    public async Task<ErrorOr<WhatsAppTestResponse>> Handle(SendWhatsAppTestCommand request, CancellationToken cancellationToken)
    {
        if (WhatsAppPhone.Normalize(request.Phone) is not string phone)
        {
            return MarketingErrors.InvalidTestPhone;
        }

        WhatsAppSettings? settings = await db.WhatsAppSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);
        if (settings is null || !settings.IsConfigured)
        {
            return MarketingErrors.ApiNotConfigured;
        }

        string? mediaId = null;
        if (settings.HasImageHeader)
        {
            MarketingMedia? image = request.ImageId is Guid imageId
                ? await db.MarketingMedia.AsNoTracking()
                    .FirstOrDefaultAsync(m => m.Id == imageId && m.TenantId == request.TenantId, cancellationToken)
                : MarketingMedia.Create(request.TenantId, PlaceholderImage.ContentType, PlaceholderImage.Png);
            if (image is null)
            {
                return MarketingErrors.MediaNotFound;
            }

            WhatsAppSendResult uploaded = await whatsApp.UploadImageAsync(settings, image, cancellationToken);
            if (!uploaded.Ok || uploaded.MessageId is null)
            {
                return MarketingErrors.SendStopped("لم يقبل واتساب الصورة: " + uploaded.Error);
            }

            mediaId = uploaded.MessageId;
        }

        string name = string.IsNullOrWhiteSpace(request.Name) ? "محمد" : request.Name.Trim();
        string message = string.IsNullOrWhiteSpace(request.Message)
            ? SampleMessage
            : request.Message.Trim().Replace(MarketingCampaign.NamePlaceholder, name, StringComparison.Ordinal);
        WhatsAppSendResult sent = await whatsApp.SendTemplateAsync(settings, phone, name, message, mediaId, cancellationToken);
        return sent.Ok ? new WhatsAppTestResponse(phone, sent.MessageId) : MarketingErrors.SendStopped(sent.Error);
    }
}
