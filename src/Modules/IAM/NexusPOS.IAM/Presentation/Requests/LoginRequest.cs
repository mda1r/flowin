namespace NexusPOS.IAM.Presentation.Requests;

public sealed record LoginRequest(
    string Email,
    string Password,
    string? DeviceInfo = null);
