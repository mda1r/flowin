using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ListDiscountCodes;

internal sealed class ListDiscountCodesQueryHandler(IDiscountCodeRepository discountCodeRepository)
    : IQueryHandler<ListDiscountCodesQuery, IReadOnlyList<DiscountCodeResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<DiscountCodeResponse>>> Handle(
        ListDiscountCodesQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<DiscountCode> codes =
            await discountCodeRepository.FindByTenantAsync(request.TenantId, cancellationToken);

        return codes.Select(RestaurantOrderMapper.ToResponse).ToList();
    }
}
