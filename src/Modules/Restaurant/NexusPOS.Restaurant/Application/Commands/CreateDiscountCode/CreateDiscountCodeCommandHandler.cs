using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.CreateDiscountCode;

internal sealed class CreateDiscountCodeCommandHandler(
    IDiscountCodeRepository discountCodeRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<CreateDiscountCodeCommand, DiscountCodeResponse>
{
    public async Task<ErrorOr<DiscountCodeResponse>> Handle(
        CreateDiscountCodeCommand request,
        CancellationToken cancellationToken)
    {
        ErrorOr<DiscountCode> codeResult = DiscountCode.Create(
            request.TenantId,
            request.Code,
            request.Type,
            request.Value,
            request.MinOrderAmount,
            request.MaxUses,
            request.ExpiryDate);

        if (codeResult.IsError)
        {
            return codeResult.Errors;
        }

        discountCodeRepository.Add(codeResult.Value);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantOrderMapper.ToResponse(codeResult.Value);
    }
}
