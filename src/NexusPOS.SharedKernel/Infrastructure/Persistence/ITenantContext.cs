namespace NexusPOS.SharedKernel.Infrastructure.Persistence;

public interface ITenantContext
{
    Guid? TenantId { get; }
    string SchemaName { get; }
    Guid? BranchId { get; }
    Guid? UserId { get; }
    bool IsAuthenticated { get; }
}
