export { emitTableChange, onTableChange } from './bus'
// Veri katmanı genel API'si (Faz 2 store'ları buradan import eder).
export { getDb, isTauriRuntime, resolveWriteUid } from './client'
export {
  deleteRow,
  deleteTrnsReferencing,
  upsertRow,
  upsertRows,
} from './mutations'
export { type OutboxOp, recordOutbox } from './outbox'
export {
  categoryToRow,
  type Row,
  rowToCategory,
  rowToRates,
  rowToTag,
  rowToTrn,
  rowToWallet,
  tagToRow,
  trnToRow,
  ts,
  walletToRow,
} from './transforms'
export { type WatchHandle, watchTable } from './watch'
