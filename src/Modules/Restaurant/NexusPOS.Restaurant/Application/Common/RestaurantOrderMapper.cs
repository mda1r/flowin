using NexusPOS.Restaurant.Domain.Entities;

namespace NexusPOS.Restaurant.Application.Common;

internal static class RestaurantOrderMapper
{
    public static RestaurantOrderResponse ToResponse(RestaurantOrder order)
    {
        return new RestaurantOrderResponse(
            Id: order.Id.Value,
            TenantId: order.TenantId,
            BranchId: order.BranchId,
            TableNumber: order.TableNumber,
            Status: order.Status,
            Notes: order.Notes,
            AppliedDiscountCode: order.AppliedDiscountCode,
            DiscountAmount: order.DiscountAmount,
            SubTotal: order.SubTotal,
            TaxAmount: order.TaxAmount,
            Total: order.Total,
            PaymentMethod: order.PaymentMethod,
            AmountTendered: order.AmountTendered,
            CreatedAt: order.CreatedAt,
            ServedAt: order.ServedAt,
            PaidAt: order.PaidAt,
            Items: order.Items
                .Select(i => new RestaurantOrderItemResponse(
                    Id: i.Id.Value,
                    MenuItemId: i.MenuItemId,
                    ItemName: i.ItemName,
                    Quantity: i.Quantity,
                    UnitPrice: i.UnitPrice,
                    LineTotal: i.LineTotal,
                    Notes: i.Notes,
                    Status: i.Status))
                .ToList());
    }

    public static DiscountCodeResponse ToResponse(DiscountCode code)
    {
        return new DiscountCodeResponse(
            Id: code.Id.Value,
            TenantId: code.TenantId,
            Code: code.Code,
            Type: code.Type,
            Value: code.Value,
            MinOrderAmount: code.MinOrderAmount,
            MaxUses: code.MaxUses,
            UsedCount: code.UsedCount,
            ExpiryDate: code.ExpiryDate,
            IsActive: code.IsActive,
            CreatedAt: code.CreatedAt);
    }
}
