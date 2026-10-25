using ErrorOr;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Infrastructure.Persistence;
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
    bool IncludeNameVariable) : ICommand<WhatsAppSettingsResponse>;

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
            request.HasImageHeader, request.IncludeNameVariable);
        await db.SaveChangesAsync(cancellationToken);
        return MarketingMapper.ToResponse(settings);
    }
}
