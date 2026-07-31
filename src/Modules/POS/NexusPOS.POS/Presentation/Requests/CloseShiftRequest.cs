namespace NexusPOS.POS.Presentation.Requests;

public sealed record CloseShiftRequest(decimal ClosingCash, string? Notes = null);
