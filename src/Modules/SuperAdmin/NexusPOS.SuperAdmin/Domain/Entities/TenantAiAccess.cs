namespace NexusPOS.SuperAdmin.Domain.Entities;

public sealed class TenantAiAccess
{
    public Guid TenantId { get; private set; }
    public bool AiEnabled { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private TenantAiAccess() { }

    public static TenantAiAccess Create(Guid tenantId, bool enabled) =>
        new() { TenantId = tenantId, AiEnabled = enabled, UpdatedAt = DateTime.UtcNow };

    public void SetEnabled(bool enabled)
    {
        AiEnabled = enabled;
        UpdatedAt = DateTime.UtcNow;
    }
}
