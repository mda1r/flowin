namespace NexusPOS.POS.Presentation.Requests;

public sealed record CloseShiftRequest(decimal ClosingCash, decimal ClosingCardCount = 0, string? Notes = null);
