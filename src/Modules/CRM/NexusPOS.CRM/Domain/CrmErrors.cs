using ErrorOr;

namespace NexusPOS.CRM.Domain;

public static class CrmErrors
{
    public static readonly Error CustomerNotFound =
        Error.NotFound("Customer.NotFound", "Customer not found.");

    public static readonly Error CustomerEmailTaken =
        Error.Conflict("Customer.EmailTaken", "A customer with this email already exists.");

    public static readonly Error InsufficientLoyaltyPoints =
        Error.Validation("Customer.InsufficientLoyaltyPoints", "Customer does not have enough loyalty points.");

    public static readonly Error InvalidLoyaltyPoints =
        Error.Validation("Customer.InvalidLoyaltyPoints", "Loyalty points must be greater than zero.");
}
