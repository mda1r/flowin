using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Queries.GetTaxScopesByBrand;

public sealed record GetTaxScopesByBrandQuery(Guid? BrandId) : IQuery<List<TaxScopeResponse>>;
