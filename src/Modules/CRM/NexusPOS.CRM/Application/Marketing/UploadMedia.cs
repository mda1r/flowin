using ErrorOr;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Marketing;

public sealed record UploadMediaCommand(Guid TenantId, string ContentType, string Base64) : ICommand<MediaResponse>;

internal sealed class UploadMediaCommandHandler(CrmDbContext db) : ICommandHandler<UploadMediaCommand, MediaResponse>
{
    public async Task<ErrorOr<MediaResponse>> Handle(UploadMediaCommand request, CancellationToken cancellationToken)
    {
        if (!MarketingMedia.AllowedTypes.Contains(request.ContentType))
        {
            return MarketingErrors.InvalidImage;
        }

        byte[] data;
        try
        {
            data = Convert.FromBase64String(request.Base64);
        }
        catch (FormatException)
        {
            return MarketingErrors.InvalidImage;
        }

        if (data.Length is 0 or > MarketingMedia.MaxBytes)
        {
            return MarketingErrors.InvalidImage;
        }

        MarketingMedia media = MarketingMedia.Create(request.TenantId, request.ContentType, data);
        db.MarketingMedia.Add(media);
        await db.SaveChangesAsync(cancellationToken);
        return new MediaResponse(media.Id, MarketingMapper.MediaPath(media.Id));
    }
}
