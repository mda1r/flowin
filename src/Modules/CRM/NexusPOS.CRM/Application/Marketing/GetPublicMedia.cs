using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.CRM.Domain.Marketing;
using NexusPOS.CRM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Marketing;

public sealed record PublicMedia(string ContentType, byte[] Data);

// Anonymous by design: offer images are meant to be seen, and the 128-bit random id is the only key.
public sealed record GetPublicMediaQuery(Guid Id) : IQuery<PublicMedia>;

internal sealed class GetPublicMediaQueryHandler(CrmDbContext db) : IQueryHandler<GetPublicMediaQuery, PublicMedia>
{
    public async Task<ErrorOr<PublicMedia>> Handle(GetPublicMediaQuery request, CancellationToken cancellationToken)
    {
        PublicMedia? media = await db.MarketingMedia
            .AsNoTracking()
            .Where(m => m.Id == request.Id)
            .Select(m => new PublicMedia(m.ContentType, m.Data))
            .FirstOrDefaultAsync(cancellationToken);
        return media is null ? MarketingErrors.MediaNotFound : media;
    }
}
