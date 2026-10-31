using ErrorOr;
using NexusPOS.IAM.Domain.Enums;

namespace NexusPOS.IAM.Domain;

/// <summary>
/// Who may manage whom inside a tenant. Only an Owner may create, change or remove an Owner,
/// and the tenant's last active Owner can never be removed or demoted.
/// </summary>
public static class UserManagementRules
{
    public static readonly Error OwnerOnly =
        Error.Forbidden("User.OwnerOnly", "فقط المالك يستطيع إدارة حسابات الملاك");

    public static readonly Error LastOwner =
        Error.Forbidden("User.LastOwner", "لا يمكن إيقاف أو تغيير دور آخر مالك نشط");

    public static readonly Error InvalidRole =
        Error.Validation("User.InvalidRole", "الدور غير صالح");

    public static readonly Error CannotManageSelf =
        Error.Forbidden("User.CannotManageSelf", "لا يمكنك تنفيذ هذا الإجراء على حسابك");

    public static bool IsOwner(IEnumerable<string> callerRoles) =>
        callerRoles.Contains(nameof(UserRole.Owner));

    /// <summary>Parses a role a tenant admin may assign (never SuperAdmin).</summary>
    public static ErrorOr<UserRole> ParseAssignableRole(string role) =>
        Enum.TryParse(role, out UserRole parsed) && Enum.IsDefined(parsed) && parsed != UserRole.SuperAdmin
            ? parsed
            : InvalidRole;

    /// <summary>Can the caller grant <paramref name="role"/> to someone?</summary>
    public static ErrorOr<Success> CanAssign(IEnumerable<string> callerRoles, UserRole role) =>
        role == UserRole.Owner && !IsOwner(callerRoles) ? OwnerOnly : Result.Success;

    /// <summary>Can the caller edit, suspend or reset the password of a user holding <paramref name="targetRoles"/>?</summary>
    public static ErrorOr<Success> CanManage(IEnumerable<string> callerRoles, IReadOnlyCollection<UserRole> targetRoles)
    {
        if (targetRoles.Contains(UserRole.SuperAdmin))
        {
            return Error.Forbidden("User.SuperAdmin", "لا يمكن تعديل حساب مدير النظام");
        }

        return targetRoles.Contains(UserRole.Owner) && !IsOwner(callerRoles) ? OwnerOnly : Result.Success;
    }

    /// <summary>
    /// Guards against leaving the tenant without an active Owner when <paramref name="targetRoles"/>
    /// stops being an active Owner (deactivated, deleted or demoted).
    /// </summary>
    public static ErrorOr<Success> EnsureNotLastOwner(
        IReadOnlyCollection<UserRole> targetRoles,
        bool targetIsActive,
        int activeOwnerCount) =>
        targetIsActive && targetRoles.Contains(UserRole.Owner) && activeOwnerCount <= 1
            ? LastOwner
            : Result.Success;
}
