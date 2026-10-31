using ErrorOr;

namespace NexusPOS.Finance.Domain;

public static class FinanceErrors
{
    public static readonly Error ExpenseNotFound =
        Error.NotFound("Expense.NotFound", "المصروف غير موجود");

    public static readonly Error ExpenseAlreadyApproved =
        Error.Conflict("Expense.AlreadyApproved", "تم اعتماد المصروف مسبقاً");

    public static readonly Error ExpenseAlreadyVoided =
        Error.Conflict("Expense.AlreadyVoided", "تم إلغاء المصروف مسبقاً");

    public static readonly Error ExpenseNotPending =
        Error.Conflict("Expense.NotPending", "لا يمكن تعديل المصروف إلا وهو بانتظار الاعتماد");

    public static readonly Error NoTenant =
        Error.Unauthorized("Finance.NoTenant", "Tenant context is required.");

    public static readonly Error NoUser =
        Error.Unauthorized("Finance.NoUser", "A signed-in user is required.");

    public static readonly Error InvalidAmount =
        Error.Validation("Expense.InvalidAmount", "مبلغ المصروف يجب أن يكون أكبر من صفر");
}
