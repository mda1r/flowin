namespace NexusPOS.SuperAdmin.Presentation.Requests;

public sealed record CreateTaxScopeRequest(
    string Name,
    string VatRegistrationNumber,
    string LegalEntityName);
