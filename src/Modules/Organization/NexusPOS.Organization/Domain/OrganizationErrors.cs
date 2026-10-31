using ErrorOr;

namespace NexusPOS.Organization.Domain;

public static class OrganizationErrors
{
    public static readonly Error TenantNotFound =
        Error.NotFound("Organization.TenantNotFound", "Tenant was not found.");

    public static readonly Error SubdomainAlreadyExists =
        Error.Conflict("Organization.SubdomainAlreadyExists", "A tenant with this subdomain already exists.");

    public static readonly Error TenantSuspended =
        Error.Forbidden("Organization.TenantSuspended", "This tenant account has been suspended.");

    public static readonly Error BranchNotFound =
        Error.NotFound("Organization.BranchNotFound", "Branch was not found.");

    public static readonly Error BranchAlreadyExists =
        Error.Conflict("Organization.BranchAlreadyExists", "A branch with this name already exists for the tenant.");

    public static readonly Error BranchInactive =
        Error.Forbidden("Organization.BranchInactive", "This branch is currently inactive.");

    public static readonly Error CannotDeactivateMainBranch =
        Error.Conflict("Organization.CannotDeactivateMainBranch", "The main branch cannot be deactivated. Set another branch as main first.");

    public static readonly Error MainBranchMustBeActive =
        Error.Conflict("Organization.MainBranchMustBeActive", "Only an active branch can be set as the main branch.");

    public static readonly Error InvalidSubdomain =
        Error.Validation("Organization.InvalidSubdomain", "Subdomain must be 3-63 characters, lowercase alphanumeric or hyphens, and cannot start or end with a hyphen.");
}
