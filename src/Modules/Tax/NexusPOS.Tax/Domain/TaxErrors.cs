using ErrorOr;

namespace NexusPOS.Tax.Domain;

public static class TaxErrors
{
    public static Error PeriodNotFound => Error.NotFound("TaxPeriod.NotFound", "Tax period not found.");

    // A closed period has been filed with ZATCA; its figures must not move any more.
    public static Error PeriodClosed => Error.Conflict(
        "TaxPeriod.Closed",
        "This tax period is closed and can no longer be changed.");

    // The POS sales or returns could not be read, so the ledger may be missing transactions.
    public static Error LedgerSyncFailed => Error.Unexpected(
        "TaxLedger.SyncFailed",
        "Sales and returns could not be read right now. Try again shortly.");
}
