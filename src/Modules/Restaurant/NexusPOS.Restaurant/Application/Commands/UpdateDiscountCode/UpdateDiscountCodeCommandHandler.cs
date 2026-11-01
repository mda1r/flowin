using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.UpdateDiscountCode;

internal sealed class UpdateDiscountCodeCommandHandler(
    IDiscountCodeRepository discountCodeRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<UpdateDiscountCodeCommand, DiscountCodeResponse>
{
    public async Task<ErrorOr<DiscountCodeResponse>> Handle(
        UpdateDiscountCodeCommand request,
        CancellationToken cancellationToken)
    {
        DiscountCodeId id = new(request.Id);
        DiscountCode? code = await discountCodeRepository.FindByIdAsync(id, cancellationToken);
        if (code is null || code.TenantId != request.TenantId)
        {
            return RestaurantErrors.DiscountCodeNotFound;
        }

        if (await discountCodeRepository.ExistsAsync(request.TenantId, request.Code, id, cancellationToken))
        {
            return RestaurantErrors.DiscountCodeExists;
        }

        ErrorOr<Success> updated = code.Update(
            request.Code,
            request.Label,
            request.Type,
            request.Value,
            request.MinOrderAmount,
            request.MaxUses,
            request.ExpiryDate,
            request.IsActive);
        if (updated.IsError)
        {
            return updated.Errors;
        }

        discountCodeRepository.Update(code);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RestaurantOrderMapper.ToResponse(code);
    }
}
