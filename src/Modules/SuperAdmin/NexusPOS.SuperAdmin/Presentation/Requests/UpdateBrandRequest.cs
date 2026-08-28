namespace NexusPOS.SuperAdmin.Presentation.Requests;

public sealed record UpdateBrandRequest(
    string NameAr,
    string NameEn,
    string? Notes,
    string? Status);
