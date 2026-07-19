using Microsoft.EntityFrameworkCore;
using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.Repositories;
using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.Infrastructure.Persistence.Repositories;

internal sealed class UserRepository(IamDbContext dbContext) : IUserRepository
{
    public async Task<User?> FindByIdAsync(UserId id, CancellationToken cancellationToken = default)
    {
        return await dbContext.Users
            .Include(u => u.RefreshTokens)
            .Include(u => u.PasskeyCredentials)
            .Include(u => u.TotpSecret)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
    }

    public async Task<User?> FindByEmailAsync(Email email, CancellationToken cancellationToken = default)
    {
        return await dbContext.Users
            .Include(u => u.RefreshTokens)
            .FirstOrDefaultAsync(
                u => u.Email.Value == email.Value,
                cancellationToken);
    }

    public async Task<bool> ExistsByEmailAsync(Email email, CancellationToken cancellationToken = default)
    {
        return await dbContext.Users
            .AnyAsync(u => u.Email.Value == email.Value, cancellationToken);
    }

    public async Task<User?> FindByRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        return await dbContext.Users
            .Include(u => u.RefreshTokens)
            .FirstOrDefaultAsync(
                u => u.RefreshTokens.Any(rt => rt.Token == token),
                cancellationToken);
    }

    public void Add(User user)
    {
        dbContext.Users.Add(user);
    }

    public void Update(User user)
    {
        dbContext.Users.Update(user);
    }
}
