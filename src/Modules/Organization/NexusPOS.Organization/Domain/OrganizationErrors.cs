using ErrorOr;

namespace NexusPOS.Organization.Domain;

public static class OrganizationErrors
{
    public static readonly Error TenantNotFound =
        Error.NotFound("Organization.TenantNotFound", "المنشأة غير موجودة");

    public static readonly Error SubdomainAlreadyExists =
        Error.Conflict("Organization.SubdomainAlreadyExists", "النطاق الفرعي مستخدم مسبقاً");

    public static readonly Error TenantSuspended =
        Error.Forbidden("Organization.TenantSuspended", "حساب المنشأة موقوف");

    public static readonly Error BranchNotFound =
        Error.NotFound("Organization.BranchNotFound", "الفرع غير موجود");

    public static readonly Error BranchAlreadyExists =
        Error.Conflict("Organization.BranchAlreadyExists", "يوجد فرع بنفس الاسم");

    public static readonly Error BranchInactive =
        Error.Forbidden("Organization.BranchInactive", "هذا الفرع غير نشط");

    public static readonly Error InvalidSubdomain =
        Error.Validation("Organization.InvalidSubdomain", "النطاق الفرعي من 3 إلى 63 حرفاً: حروف إنجليزية صغيرة وأرقام وشرطات، ولا يبدأ أو ينتهي بشرطة");
}
