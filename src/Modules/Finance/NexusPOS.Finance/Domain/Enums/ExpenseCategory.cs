namespace NexusPOS.Finance.Domain.Enums;

// Stored by name (see ExpenseConfiguration), so new members only need a new number; never renumber or rename.
public enum ExpenseCategory
{
    Rent = 1,
    Utilities = 2,
    Wages = 3,
    Supplies = 4,
    Equipment = 5,
    Marketing = 6,
    Maintenance = 7,
    GovernmentFees = 8,
    Subscriptions = 9,
    DeliveryCommissions = 10,
    BankFees = 11,
    Insurance = 12,
    Transport = 13,
    Other = 99,
}
