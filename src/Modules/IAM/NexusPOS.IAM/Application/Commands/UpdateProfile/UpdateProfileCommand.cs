using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.UpdateProfile;

public sealed record UpdateProfileCommand(Guid UserId, string FirstName, string LastName) : ICommand;
