using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Queries.GetAllowedPages;

internal sealed class GetAllowedPagesQueryHandler(IamDbContext db)
    : IQueryHandler<GetAllowedPagesQuery, List<string>?>
{
    public async Task<ErrorOr<List<string>?>> Handle(
        GetAllowedPagesQuery request,
        CancellationToken cancellationToken)
    {
        var id = new UserId(request.UserId);
        List<string>? pages = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == id && u.TenantId == request.TenantId)
            .Select(u => u.AllowedPages)
            .FirstOrDefaultAsync(cancellationToken);

        return pages;
    }
}
