// Retention of actual wallet and order money events is unsafe here.
// These records are part of the courier/accounting ledger and must not be deleted automatically.
export async function cleanupOldReportLedgerRows() {
  // No-op until a proper report-only cache or archive table exists.
  return;
}
