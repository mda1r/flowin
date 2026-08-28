namespace NexusPOS.SuperAdmin.Presentation.Requests;

public sealed record CreateBrandRequest(
    string NameAr,
    string NameEn,
    string Code,
    string? Notes);
