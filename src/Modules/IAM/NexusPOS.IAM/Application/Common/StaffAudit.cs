using MediatR;
using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.IAM.Application.Common;

/// <summary>
/// Server-side audit trail for staff-account changes. Handlers call it before saving, so a change
/// whose log entry cannot be written is not applied either.
/// </summary>
internal static class StaffAudit
{
    public const string Created = "إضافة مستخدم";
    public const string Edited = "تعديل مستخدم";
    public const string RoleChanged = "تغيير دور مستخدم";
    public const string Deactivated = "إيقاف مستخدم";
    public const string Reactivated = "إعادة تفعيل مستخدم";
    public const string PasswordReset = "إعادة تعيين كلمة المرور";
    public const string Deleted = "حذف مستخدم";
    public const string PagesChanged = "تغيير صفحات مستخدم";

    public static string RoleLabel(UserRole role) => role switch
    {
        UserRole.Owner => "مالك",
        UserRole.Manager => "مدير",
        UserRole.Cashier => "كاشير",
        UserRole.Accountant => "محاسب",
        UserRole.Staff => "موظف",
        _ => role.ToString(),
    };

    public static string Describe(User target) => $"{target.FullName} — {target.Email.Value}";

    public static async Task PublishStaffChangeAsync(
        this IPublisher publisher,
        IamDbContext db,
        Guid tenantId,
        Guid actorUserId,
        string action,
        string details,
        CancellationToken cancellationToken)
    {
        // The actor is the authenticated caller; read the name fresh so the entry shows who they are now.
        var actorId = new UserId(actorUserId);
        var actor = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == actorId && u.TenantId == tenantId)
            .Select(u => new { u.FirstName, u.LastName, Email = u.Email.Value })
            .FirstOrDefaultAsync(cancellationToken);

        await publisher.Publish(
            new StaffAccountChangedDomainEvent(
                tenantId,
                actorUserId,
                actor is null ? string.Empty : $"{actor.FirstName} {actor.LastName}".Trim(),
                actor?.Email,
                action,
                details),
            cancellationToken);
    }
}
