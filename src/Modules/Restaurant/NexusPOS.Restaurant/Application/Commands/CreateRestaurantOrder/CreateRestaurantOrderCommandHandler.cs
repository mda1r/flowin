using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using Npgsql;

namespace NexusPOS.Restaurant.Application.Commands.CreateRestaurantOrder;

internal sealed class CreateRestaurantOrderCommandHandler(
    IRestaurantOrderRepository orderRepository,
    IDiscountCodeRepository discountCodeRepository,
    RestaurantDbContext dbContext)
    : ICommandHandler<CreateRestaurantOrderCommand, RestaurantOrderResponse>
{
    public async Task<ErrorOr<RestaurantOrderResponse>> Handle(
        CreateRestaurantOrderCommand request,
        CancellationToken cancellationToken)
    {
        // The cafe till resends a kitchen ticket it could not confirm; one that already arrived is returned as is.
        string? ticketNumber = string.IsNullOrWhiteSpace(request.TicketNumber) ? null : request.TicketNumber.Trim();
        if (ticketNumber is not null)
        {
            RestaurantOrder? existing = await FindTicketAsync(request.BranchId, ticketNumber, cancellationToken);
            if (existing is not null)
            {
                return RestaurantOrderMapper.ToResponse(existing);
            }
        }

        decimal discountAmount = 0m;
        DiscountCode? discountCode = null;

        if (!string.IsNullOrWhiteSpace(request.DiscountCode))
        {
            discountCode = await discountCodeRepository.FindByCodeAsync(
                request.TenantId, request.DiscountCode, cancellationToken);

            if (discountCode is null)
            {
                return RestaurantErrors.DiscountCodeNotFound;
            }

            decimal subTotal = request.Items.Sum(i => i.UnitPrice * i.Quantity);
            ErrorOr<Success> validation = discountCode.Validate(subTotal);
            if (validation.IsError)
            {
                return validation.Errors;
            }

            discountAmount = discountCode.ComputeDiscount(subTotal);
        }

        var itemsData = request.Items
            .Select(i => (i.MenuItemId, i.ItemName, i.Quantity, i.UnitPrice, i.Notes))
            .ToList();

        ErrorOr<RestaurantOrder> orderResult = RestaurantOrder.Create(
            request.TenantId,
            request.BranchId,
            request.TableNumber,
            itemsData,
            request.Notes,
            request.DiscountCode,
            discountAmount,
            request.TicketNumber);

        if (orderResult.IsError)
        {
            return orderResult.Errors;
        }

        RestaurantOrder order = orderResult.Value;
        orderRepository.Add(order);

        if (discountCode is not null)
        {
            discountCode.IncrementUsage();
            discountCodeRepository.Update(discountCode);
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ticketNumber is not null && IsTicketClash(ex))
        {
            // Another till (or tab) sent the same ticket between the lookup and this insert: it is already in.
            dbContext.ChangeTracker.Clear();
            RestaurantOrder? existing = await FindTicketAsync(request.BranchId, ticketNumber, cancellationToken);
            return existing is null ? RestaurantErrors.TicketNumberTaken : RestaurantOrderMapper.ToResponse(existing);
        }

        return RestaurantOrderMapper.ToResponse(order);
    }

    // The unique patch index (DatabaseInitializerExtensions) is what stops a duplicate ticket per branch.
    internal static bool IsTicketClash(DbUpdateException ex) =>
        ex.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "ux_restaurant_orders_branch_ticket",
        };

    private Task<RestaurantOrder?> FindTicketAsync(Guid branchId, string ticketNumber, CancellationToken cancellationToken) =>
        orderRepository.FindByTicketAsync(
            branchId, ticketNumber, DateTime.UtcNow - RestaurantOrderQueries.LookBack, cancellationToken);
}
