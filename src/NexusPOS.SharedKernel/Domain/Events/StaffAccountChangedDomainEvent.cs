namespace NexusPOS.SharedKernel.Domain.Events;

// Cross-module contract: IAM raises it for every privileged staff-account change (create, role change,
// suspend, password reset, delete) so POS writes the tenant-wide activity log entry on the server.
// Actor fields come from the authenticated caller, never from the request body.
public sealed record StaffAccountChangedDomainEvent(
    Guid TenantId,
    Guid ActorUserId,
    string ActorName,
    string? ActorEmail,
    string Action,
    string Details) : DomainEvent;
