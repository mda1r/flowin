using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Domain.Entities;
using NexusPOS.SuperAdmin.Infrastructure.Persistence;

namespace NexusPOS.SuperAdmin.Application.Commands.SetTenantAiAccess;

internal sealed class SetTenantAiAccessCommandHandler(SuperAdminDbContext db)
    : ICommandHandler<SetTenantAiAccessCommand>
{
    public async Task<ErrorOr<Success>> Handle(
        SetTenantAiAccessCommand request,
        CancellationToken cancellationToken)
    {
        TenantAiAccess? existing = await db.TenantAiAccesses
            .FirstOrDefaultAsync(a => a.TenantId == request.TenantId, cancellationToken);

        if (existing is null)
        {
            db.TenantAiAccesses.Add(TenantAiAccess.Create(request.TenantId, request.Enabled));
        }
        else
        {
            existing.SetEnabled(request.Enabled);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success;
    }
}
