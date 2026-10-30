using ErrorOr;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Zatca.Domain.Entities;
using NexusPOS.Zatca.Infrastructure.Persistence;

namespace NexusPOS.Zatca.Application.Receipts;

public sealed record ReceiptSettingsResponse(
    string? LogoPath,
    string? Phone,
    string? Address,
    string? HeaderNote,
    string? FooterNote,
    int PaperWidthMm,
    bool ShowPoweredBy);

internal static class ReceiptSettingsMapper
{
    public static ReceiptSettingsResponse ToResponse(ReceiptSettings? s) => s is null
        ? new(null, null, null, null, null, 80, true)
        : new(s.LogoPath, s.Phone, s.Address, s.HeaderNote, s.FooterNote, s.PaperWidthMm, s.ShowPoweredBy);
}

public sealed record GetReceiptSettingsQuery(Guid TenantId) : IQuery<ReceiptSettingsResponse>;

internal sealed class GetReceiptSettingsQueryHandler(ZatcaDbContext db) : IQueryHandler<GetReceiptSettingsQuery, ReceiptSettingsResponse>
{
    public async Task<ErrorOr<ReceiptSettingsResponse>> Handle(GetReceiptSettingsQuery request, CancellationToken cancellationToken)
    {
        ReceiptSettings? settings = await db.ReceiptSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);
        return ReceiptSettingsMapper.ToResponse(settings);
    }
}

public sealed record SaveReceiptSettingsCommand(
    Guid TenantId,
    string? LogoPath,
    string? Phone,
    string? Address,
    string? HeaderNote,
    string? FooterNote,
    int PaperWidthMm,
    bool ShowPoweredBy) : ICommand<ReceiptSettingsResponse>;

internal sealed class SaveReceiptSettingsCommandValidator : AbstractValidator<SaveReceiptSettingsCommand>
{
    public SaveReceiptSettingsCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        // Only images uploaded to flowin, so a receipt never loads anything from an outside server.
        RuleFor(x => x.LogoPath)
            .Matches("^/api/v1/public/media/[0-9a-fA-F-]{36}$")
            .When(x => !string.IsNullOrWhiteSpace(x.LogoPath))
            .WithMessage("شعار المحل يجب أن يُرفع من صفحة إعدادات الفاتورة.");
        RuleFor(x => x.Phone).MaximumLength(40);
        RuleFor(x => x.Address).MaximumLength(200);
        RuleFor(x => x.HeaderNote).MaximumLength(300).WithMessage("النص أعلى الفاتورة أطول من 300 حرف.");
        RuleFor(x => x.FooterNote).MaximumLength(500).WithMessage("النص أسفل الفاتورة أطول من 500 حرف.");
        RuleFor(x => x.PaperWidthMm)
            .Must(ReceiptSettings.PaperWidths.Contains)
            .WithMessage("مقاس الورق 58 أو 80 ملم.");
    }
}

internal sealed class SaveReceiptSettingsCommandHandler(ZatcaDbContext db) : ICommandHandler<SaveReceiptSettingsCommand, ReceiptSettingsResponse>
{
    public async Task<ErrorOr<ReceiptSettingsResponse>> Handle(SaveReceiptSettingsCommand request, CancellationToken cancellationToken)
    {
        ReceiptSettings? settings = await db.ReceiptSettings
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);
        if (settings is null)
        {
            settings = ReceiptSettings.Create(request.TenantId);
            db.ReceiptSettings.Add(settings);
        }

        settings.Update(
            request.LogoPath, request.Phone, request.Address, request.HeaderNote, request.FooterNote,
            request.PaperWidthMm, request.ShowPoweredBy);
        await db.SaveChangesAsync(cancellationToken);
        return ReceiptSettingsMapper.ToResponse(settings);
    }
}
