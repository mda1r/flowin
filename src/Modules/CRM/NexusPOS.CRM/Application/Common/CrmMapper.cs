using NexusPOS.CRM.Domain.Entities;

namespace NexusPOS.CRM.Application.Common;

internal static class CrmMapper
{
    internal static CustomerResponse ToResponse(Customer customer) => new(
        customer.Id.Value,
        customer.TenantId,
        customer.Name,
        customer.Email,
        customer.Phone,
        customer.Address,
        customer.DateOfBirth,
        customer.LoyaltyPoints,
        customer.Notes,
        customer.IsActive,
        customer.CreatedAt);
}
