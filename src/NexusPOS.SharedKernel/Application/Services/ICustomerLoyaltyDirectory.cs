namespace NexusPOS.SharedKernel.Application.Services;

// Lets the cashier flow read a customer's points without referencing the CRM module.
public interface ICustomerLoyaltyDirectory
{
    // Null when the customer does not exist in the tenant.
    Task<int?> GetPointsAsync(Guid tenantId, Guid customerId, CancellationToken cancellationToken = default);
}
