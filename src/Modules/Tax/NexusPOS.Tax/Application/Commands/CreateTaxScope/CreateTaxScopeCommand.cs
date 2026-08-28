using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Commands.CreateTaxScope;

public sealed record CreateTaxScopeCommand(
    Guid? BrandId,
    string Name,
    string VatRegistrationNumber,
    string LegalEntityName,
    Guid ActorId) : ICommand<TaxScopeResponse>;
