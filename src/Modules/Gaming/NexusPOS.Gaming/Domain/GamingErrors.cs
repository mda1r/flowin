using ErrorOr;

namespace NexusPOS.Gaming.Domain;

public static class GamingErrors
{
    public static readonly Error StationNotFound =
        Error.NotFound("GameStation.NotFound", "Game station not found.");

    public static readonly Error InvalidHourlyRate =
        Error.Validation("GameStation.InvalidHourlyRate", "Hourly rate must be greater than zero.");

    public static readonly Error StationNotAvailable =
        Error.Conflict("GameStation.NotAvailable", "Game station is not available to start a session.");

    public static readonly Error StationNotInUse =
        Error.Conflict("GameStation.NotInUse", "Game station is not currently in use.");

    public static readonly Error SessionNotFound =
        Error.NotFound("GameSession.NotFound", "Game session not found.");

    public static readonly Error SessionNotActive =
        Error.Conflict("GameSession.NotActive", "Game session is not currently active.");

    public static readonly Error NoActiveSession =
        Error.Conflict("GameSession.NoActive", "No active session found for this station.");
}
