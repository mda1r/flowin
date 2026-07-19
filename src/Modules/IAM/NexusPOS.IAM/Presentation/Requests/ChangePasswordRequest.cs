namespace NexusPOS.IAM.Presentation.Requests;

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
