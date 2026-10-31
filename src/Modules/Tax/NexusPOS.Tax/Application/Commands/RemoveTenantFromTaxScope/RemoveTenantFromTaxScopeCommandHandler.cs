using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.RemoveTenantFromTaxScope;

internal sealed class RemoveTenantFromTaxScopeCommandHandler(TaxConfigDbContext taxDb)
    : ICommandHandler<RemoveTenantFromTaxScopeCommand, bool>
{
    public async Task<ErrorOr<bool>> Handle(
        RemoveTenantFromTaxScopeCommand request,
        CancellationToken cancellationToken)
    {
        var membership = await taxDb.TaxScopeMemberships
            .FirstOrDefaultAsync(m => m.Id == request.MembershipId, cancellationToken);

        if (membership is null)
        {
            return Error.NotFound("TaxScopeMembership.NotFound", "Tax scope membership not found");
        }

        if (membership.EffectiveTo.HasValue)
        {
            return Error.Conflict("TaxScopeMembership.AlreadyRemoved", "Tenant has already been removed from this tax scope");
        }

        membership.Remove(request.ActorId, request.Reason);
        await taxDb.SaveChangesAsync(cancellationToken);

        return true;
    }
}
