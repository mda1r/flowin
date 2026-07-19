using NexusPOS.IAM.Domain.Entities;
using NexusPOS.IAM.Domain.ValueObjects;

namespace NexusPOS.IAM.Domain.Repositories;

public interface IUserRepository
{
    Task<User?> FindByIdAsync(UserId id, CancellationToken cancellationToken = default);
    Task<User?> FindByEmailAsync(Email email, CancellationToken cancellationToken = default);
    Task<bool> ExistsByEmailAsync(Email email, CancellationToken cancellationToken = default);
    Task<User?> FindByRefreshTokenAsync(string token, CancellationToken cancellationToken = default);
    void Add(User user);
    void Update(User user);
}
