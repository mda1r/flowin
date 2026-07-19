namespace NexusPOS.IAM.Presentation.Requests;

public sealed record LogoutRequest(
    string RefreshToken,
    bool LogoutAllDevices = false);
