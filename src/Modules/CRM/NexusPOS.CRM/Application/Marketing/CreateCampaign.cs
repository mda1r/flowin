using ErrorOr;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Domain.ValueObjects;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Marketing;

public sealed record CreateCampaignCommand(
    Guid TenantId,
    Guid? UserId,
    string Message,
    Guid? ImageId,
    CampaignChannel Channel,
    IReadOnlyList<Guid> CustomerIds) : ICommand<CampaignResponse>;

internal sealed class CreateCampaignCommandValidator : AbstractValidator<CreateCampaignCommand>
{
    public CreateCampaignCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Channel).IsInEnum();
        RuleFor(x => x.Message).NotNull();
        RuleFor(x => x.CustomerIds).NotNull();
    }
}

internal sealed class CreateCampaignCommandHandler(CrmDbContext db) : ICommandHandler<CreateCampaignCommand, CampaignResponse>
{
    public async Task<ErrorOr<CampaignResponse>> Handle(CreateCampaignCommand request, CancellationToken cancellationToken)
    {
        if (request.ImageId is Guid imageId &&
            !await db.MarketingMedia.AnyAsync(m => m.Id == imageId && m.TenantId == request.TenantId, cancellationToken))
        {
            return MarketingErrors.MediaNotFound;
        }

        if (request.Channel == CampaignChannel.Api)
        {
            WhatsAppSettings? settings = await db.WhatsAppSettings
                .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);
            if (settings is null || !settings.IsConfigured)
            {
                return MarketingErrors.ApiNotConfigured;
            }

            if (settings.HasImageHeader && request.ImageId is null)
            {
                return MarketingErrors.ImageRequiredByTemplate;
            }
        }

        // Only this store's customers who agreed to offers and have a phone WhatsApp can reach,
        // whatever ids the page sent.
        CustomerId[] ids = [.. request.CustomerIds.Distinct().Select(id => new CustomerId(id))];
        var customers = await db.Customers
            .AsNoTracking()
            .Where(c => c.TenantId == request.TenantId && c.IsActive && c.MarketingOptIn && ids.Contains(c.Id))
            .Select(c => new { c.Id, c.Name, c.Phone })
            .ToListAsync(cancellationToken);

        List<(Guid, string, string)> recipients = [];
        foreach (var c in customers)
        {
            if (WhatsAppPhone.Normalize(c.Phone) is string phone)
            {
                recipients.Add((c.Id.Value, c.Name, phone));
            }
        }

        ErrorOr<MarketingCampaign> campaign = MarketingCampaign.Create(
            request.TenantId, request.Message, request.ImageId, request.Channel, request.UserId, recipients);
        if (campaign.IsError)
        {
            return campaign.Errors;
        }

        db.MarketingCampaigns.Add(campaign.Value);
        await db.SaveChangesAsync(cancellationToken);
        return MarketingMapper.ToResponse(campaign.Value, withRecipients: true);
    }
}
