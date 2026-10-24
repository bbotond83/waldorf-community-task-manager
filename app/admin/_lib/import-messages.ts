/**
 * One Hungarian message for every business code the import can answer (BR42.3). The table is a plain module
 * (a "use server" file may only export actions), so the action file and the tests read the same words.
 */
export const IMPORT_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  IMPORT_MALFORMED: "A munkafüzet nem olvasható.",
  IMPORT_OVERSIZED: "A munkafüzet túl nagy.",
  IMPORT_MISSING_SHEET: "Hiányzik egy kötelező munkalap.",
  IMPORT_MISSING_HEADER: "Hiányzik egy kötelező oszlop.",
  IMPORT_UNSAFE_CELL:
    "A munkafüzet nem biztonságos cellát tartalmaz (képlet, túl hosszú vagy =, + vagy @ jellel kezdődő szöveg).",
  IMPORT_MATCH_CHANGED:
    "Az adatok az előnézet óta megváltoztak; nézze át az új ütközéseket, majd erősítse meg újra.",
  IMPORT_FINGERPRINT_CHANGED: "A munkafüzet ujjlenyomata megváltozott; készítsen új előnézetet.",
  IMPORT_CONFLICT_UNRESOLVED: "Minden ütközést fel kell oldani.",
  IMPORT_CONFIRMATION_REQUIRED: "Jelölje be, hogy megerősíti a következményeket.",
  IMPORT_RECOVERY_NOT_AVAILABLE:
    "Ehhez az importhoz nincs folytatható mentés. Kezdjen új feltöltést.",
  IMPORT_RECOVERY_ACTION_INVALID: "Ez a helyreállítási művelet nem érvényes.",
  IMPORT_PREVIEW_STALE: "Az előnézet elavult; kezdje újra az ellenőrzést.",
});
