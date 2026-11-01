using ErrorOr;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Domain.ValueObjects;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Commands.DeleteDiscountCode;

internal sealed class DeleteDiscountCodeCommandHandler(
    IDiscountCodeRepository discountCodeRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<DeleteDiscountCodeCommand, Deleted>
{
    public async Task<ErrorOr<Deleted>> Handle(DeleteDiscountCodeCommand request, CancellationToken cancellationToken)
    {
        DiscountCode? code = await discountCodeRepository.FindByIdAsync(new DiscountCodeId(request.Id), cancellationToken);
        if (code is null || code.TenantId != request.TenantId)
        {
            return RestaurantErrors.DiscountCodeNotFound;
        }

        discountCodeRepository.Remove(code);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Deleted;
    }
}
