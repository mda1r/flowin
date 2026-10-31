using ErrorOr;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Settings;

// What the till needs to know; the PIN itself never leaves the server.
public sealed record PosBranchSettingsResponse(decimal MaxCashierDiscountPercent, bool HasApprovalPin);

internal static class PosBranchSettingsMapper
{
    public static PosBranchSettingsResponse ToResponse(PosBranchSettings? s) => s is null
        ? new(PosBranchSettings.DefaultMaxCashierDiscountPercent, false)
        : new(s.MaxCashierDiscountPercent, s.ApprovalPinHash is not null);
}

public sealed record GetPosBranchSettingsQuery(Guid BranchId) : IQuery<PosBranchSettingsResponse>;

internal sealed class GetPosBranchSettingsQueryHandler(PosDbContext db)
    : IQueryHandler<GetPosBranchSettingsQuery, PosBranchSettingsResponse>
{
    public async Task<ErrorOr<PosBranchSettingsResponse>> Handle(GetPosBranchSettingsQuery request, CancellationToken cancellationToken)
    {
        PosBranchSettings? settings = await db.PosBranchSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.BranchId == request.BranchId, cancellationToken);
        return PosBranchSettingsMapper.ToResponse(settings);
    }
}

// ApprovalPin: null keeps the current PIN, a value replaces it; ClearApprovalPin removes it.
public sealed record SavePosBranchSettingsCommand(
    Guid TenantId,
    Guid BranchId,
    decimal MaxCashierDiscountPercent,
    string? ApprovalPin,
    bool ClearApprovalPin) : ICommand<PosBranchSettingsResponse>;

internal sealed class SavePosBranchSettingsCommandValidator : AbstractValidator<SavePosBranchSettingsCommand>
{
    public SavePosBranchSettingsCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.MaxCashierDiscountPercent).InclusiveBetween(0m, 100m).WithMessage("حد الخصم بين 0 و100%.");
        RuleFor(x => x.ApprovalPin)
            .Matches("^[0-9]{4,8}$")
            .When(x => !string.IsNullOrEmpty(x.ApprovalPin))
            .WithMessage("رمز المدير من 4 إلى 8 أرقام.");
    }
}

internal sealed class SavePosBranchSettingsCommandHandler(PosDbContext db)
    : ICommandHandler<SavePosBranchSettingsCommand, PosBranchSettingsResponse>
{
    public async Task<ErrorOr<PosBranchSettingsResponse>> Handle(SavePosBranchSettingsCommand request, CancellationToken cancellationToken)
    {
        PosBranchSettings? settings = await db.PosBranchSettings
            .FirstOrDefaultAsync(s => s.BranchId == request.BranchId, cancellationToken);
        if (settings is null)
        {
            settings = PosBranchSettings.Create(request.TenantId, request.BranchId);
            db.PosBranchSettings.Add(settings);
        }

        settings.SetMaxCashierDiscount(request.MaxCashierDiscountPercent);
        if (request.ClearApprovalPin)
        {
            settings.SetApprovalPinHash(null);
        }
        else if (!string.IsNullOrEmpty(request.ApprovalPin))
        {
            settings.SetApprovalPinHash(ApprovalPinHasher.Hash(request.ApprovalPin));
        }

        await db.SaveChangesAsync(cancellationToken);
        return PosBranchSettingsMapper.ToResponse(settings);
    }
}
