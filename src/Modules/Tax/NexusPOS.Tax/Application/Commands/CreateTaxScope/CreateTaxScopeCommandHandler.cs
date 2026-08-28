using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.CreateTaxScope;

internal sealed class CreateTaxScopeCommandHandler(TaxConfigDbContext taxDb)
    : ICommandHandler<CreateTaxScopeCommand, TaxScopeResponse>
{
    public async Task<ErrorOr<TaxScopeResponse>> Handle(
        CreateTaxScopeCommand request,
        CancellationToken cancellationToken)
    {
        bool vatDuplicate = await taxDb.TaxRegistrationScopes
            .AnyAsync(s => s.VatRegistrationNumber == request.VatRegistrationNumber, cancellationToken);

        if (vatDuplicate)
        {
            return Error.Conflict("TaxScope.VatNumberTaken",
                $"VAT registration number '{request.VatRegistrationNumber}' is already registered");
        }

        TaxRegistrationScope scope = TaxRegistrationScope.Create(
            request.BrandId,
            request.Name,
            request.VatRegistrationNumber,
            request.LegalEntityName,
            request.ActorId);

        taxDb.TaxRegistrationScopes.Add(scope);
        await taxDb.SaveChangesAsync(cancellationToken);

        return new TaxScopeResponse(
            scope.Id, scope.Name, scope.VatRegistrationNumber,
            scope.LegalEntityName, scope.IsActive, scope.CreatedAt, []);
    }
}
