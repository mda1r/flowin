using ErrorOr;

namespace NexusPOS.Finance.Domain;

public static class FinanceErrors
{
    public static readonly Error ExpenseNotFound =
        Error.NotFound("Expense.NotFound", "Expense not found.");

    public static readonly Error ExpenseAlreadyApproved =
        Error.Conflict("Expense.AlreadyApproved", "Expense has already been approved.");

    public static readonly Error ExpenseAlreadyVoided =
        Error.Conflict("Expense.AlreadyVoided", "Expense has already been voided.");

    public static readonly Error ExpenseNotPending =
        Error.Conflict("Expense.NotPending", "Only pending expenses can be modified.");

    public static readonly Error InvalidAmount =
        Error.Validation("Expense.InvalidAmount", "Expense amount must be greater than zero.");
}
