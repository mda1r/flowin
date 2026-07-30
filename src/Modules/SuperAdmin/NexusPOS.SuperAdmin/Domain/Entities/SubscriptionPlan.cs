namespace NexusPOS.SuperAdmin.Domain.Entities;

public sealed class SubscriptionPlan
{
    public Guid Id { get; private set; }
    public string Name { get; private set; } = null!;
    public string? BusinessType { get; private set; }
    public decimal Price { get; private set; }
    public int MaxBranches { get; private set; }
    public int MaxUsers { get; private set; }
    public List<string> Features { get; private set; } = [];
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private SubscriptionPlan() { }

    public static SubscriptionPlan Create(
        string name,
        decimal price,
        int maxBranches,
        int maxUsers,
        IEnumerable<string> features,
        string? businessType = null)
    {
        return new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            BusinessType = businessType,
            Price = price,
            MaxBranches = maxBranches,
            MaxUsers = maxUsers,
            Features = [.. features],
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;

    public void UpdateFeatures(IEnumerable<string> features) => Features = [.. features];
}
