namespace NexusPOS.IAM.Presentation.Requests;

public sealed record RegisterRequest(
    string Email,
    string Password,
    string FirstName,
    string LastName);
