// Veri katmanı genel API'si (Faz 2 store'ları buradan import eder).
export { getDb, resolveWriteUid, isTauriRuntime } from './client'
export { onTableChange, emitTableChange } from './bus'
export { watchTable, type WatchHandle } from './watch'
export {
  upsertRow,
  upsertRows,
  deleteRow,
  deleteTrnsReferencing,
} from './mutations'
export { recordOutbox, type OutboxOp } from './outbox'
export {
  type Row,
  rowToTrn,
  rowToWallet,
  rowToCategory,
  rowToRates,
  rowToTag,
  trnToRow,
  walletToRow,
  categoryToRow,
  tagToRow,
} from './transforms'
