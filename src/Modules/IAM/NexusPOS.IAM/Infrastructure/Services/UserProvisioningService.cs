using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Application.Services;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Enums;
using NexusPOS.IAM.Domain.ValueObjects;
using NexusPOS.IAM.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.IAM.Infrastructure.Services;

internal sealed class UserProvisioningService(IamDbContext db, IPasswordService passwordService)
    : IUserProvisioningService
{
    private const string DefaultPassword = "Nexus@123!";

    public async Task<string> CreateTenantAdminAsync(
        string email,
        string firstName,
        string lastName,
        Guid tenantId,
        CancellationToken ct)
    {
        ErrorOr<Email> emailResult = Email.Create(email);
        if (emailResult.IsError)
        {
            throw new InvalidOperationException($"Invalid email: {email}");
        }

        User user = User.Create(emailResult.Value, firstName, lastName, tenantId);
        user.SetPassword(passwordService.HashPassword(DefaultPassword));
        user.RemoveRole(UserRole.Staff);
        user.AddRole(UserRole.Owner);
        user.VerifyEmail();
        user.ClearDomainEvents();

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        return DefaultPassword;
    }

    public async Task DeactivateAllTenantUsersAsync(Guid tenantId, CancellationToken ct)
    {
        List<User> users = await db.Users
            .Where(u => u.TenantId == tenantId)
            .ToListAsync(ct);

        foreach (User u in users)
        {
            u.Deactivate();
        }

        if (users.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
