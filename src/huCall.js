// Создано data-build/nash/make-call.mjs — не править руками.
// «Средняя» таблица колла против ва-банка один на один: соперник идёт ва-банк с shovePct % рук
// (между осторожным 20 % и Нэшем), call — руки, с которыми колл выгоден (шанс ≥ цены колла).
export const HU_CALL = {
  1: {"shovePct":60,"callPct":100,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s QTs A7o K8s JTs A3s K9o QJo A5o QTo K7s A6o 44 A2s Q9s A4o K6s K5s Q8s K8o JTo A3o Q9o J9s K7o A2o Q7s K4s K3s K6o J8s 33 Q6s T9s Q8o K5o J9o K2s Q5s T8s K4o J7s Q7o K3o Q4s J8o T9o Q6o 98s Q3s J6s K2o T7s Q5o J5s 22 Q2s J7o T8o Q4o 97s T6s J4s T7o J3s Q3o 98o J6o 87s J5o 96s Q2o J2s T5s T4s 97o T3s 95s 86s T6o J4o 96o J3o 87o 76s T2s 85s J2o T5o 94s T4o 75s 93s 86o 65s 84s 95o 76o 92s 74s T3o 85o T2o 54s 64s 83s 94o 82s 73s 75o 93o 65o 84o 53s 63s 92o 43s 54o 74o 62s 64o 52s 72s 83o 73o 42s 53o 82o 63o 32s 43o 72o 52o 62o 42o 32o"},
  2: {"shovePct":57.3,"callPct":100,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s QTs A7o K8s JTs A3s K9o QJo A5o QTo K7s A6o 44 A2s Q9s A4o K6s K5s Q8s K8o JTo A3o Q9o J9s K7o A2o Q7s K4s K3s K6o J8s 33 Q6s T9s Q8o K5o J9o K2s Q5s T8s K4o J7s Q7o K3o Q4s J8o T9o Q6o 98s Q3s J6s K2o T7s Q5o J5s 22 Q2s J7o T8o Q4o 97s T6s J4s T7o J3s Q3o 98o J6o 87s J5o 96s Q2o J2s T5s T4s 97o T3s 95s 86s T6o J4o 96o J3o 87o 76s T2s 85s J2o T5o 94s T4o 75s 93s 86o 65s 84s 95o 76o 92s 74s T3o 85o T2o 54s 64s 83s 94o 82s 73s 75o 93o 65o 84o 53s 63s 92o 43s 54o 74o 62s 64o 52s 72s 83o 73o 42s 53o 82o 63o 32s 43o 72o 52o 62o 42o 32o"},
  3: {"shovePct":52.3,"callPct":81.9,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s QTs A7o K8s JTs A3s K9o QJo A5o QTo K7s A6o 44 A2s Q9s A4o K6s K5s Q8s K8o JTo A3o Q9o J9s K7o A2o Q7s K4s K3s K6o J8s 33 Q6s T9s Q8o K5o J9o K2s Q5s T8s K4o J7s Q7o K3o Q4s J8o T9o Q6o 98s Q3s J6s K2o T7s Q5o J5s 22 Q2s J7o T8o Q4o 97s T6s J4s T7o J3s Q3o 98o J6o 87s J5o 96s Q2o J2s T5s T4s 97o T3s 95s 86s T6o J4o 96o J3o 87o 76s T2s 85s J2o 94s 75s 93s 86o 65s 84s 76o 92s 74s 54s 64s 83s 82s 73s 75o 65o 53s 63s 43s 54o 74o 62s 64o 52s 72s 42s 53o 32s"},
  4: {"shovePct":49.2,"callPct":51.1,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s QTs A7o K8s JTs A3s K9o QJo A5o QTo K7s A6o 44 A2s Q9s A4o K6s K5s Q8s K8o JTo A3o Q9o J9s K7o A2o Q7s K4s K3s K6o J8s 33 Q6s T9s Q8o K5o J9o K2s Q5s T8s K4o J7s Q7o K3o Q4s J8o T9o Q6o 98s Q3s J6s K2o T7s J5s 22 Q2s 97s T6s J4s 87s 86s 76s 65s 54s"},
  5: {"shovePct":47.1,"callPct":41.2,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s QTs A7o K8s JTs A3s K9o QJo A5o QTo K7s A6o 44 A2s Q9s A4o K6s K5s Q8s K8o JTo A3o Q9o J9s K7o A2o Q7s K4s K3s K6o J8s 33 Q6s T9s K5o J9o K2s K4o K3o K2o 22"},
  6: {"shovePct":45,"callPct":35.1,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s QTs A7o K8s JTs A3s K9o QJo A5o QTo K7s A6o 44 A2s Q9s A4o K6s K5s K8o JTo A3o J9s K7o A2o K4s K3s K6o 33 K5o K2s 22"},
  7: {"shovePct":43.1,"callPct":32.4,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s QTs A7o K8s JTs A3s K9o QJo A5o QTo K7s A6o 44 A2s Q9s A4o K6s K5s K8o JTo A3o K7o A2o K4s 33 22"},
  8: {"shovePct":41.3,"callPct":28.8,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s QTs A7o K8s JTs A3s K9o QJo A5o QTo K7s A6o 44 A2s A4o K6s A3o A2o 33 22"},
  9: {"shovePct":39.4,"callPct":27.6,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s QTs A7o K8s JTs A3s K9o QJo A5o K7s A6o 44 A2s A4o A3o A2o 33 22"},
  10: {"shovePct":38.3,"callPct":24.9,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s QTs A7o A3s A5o A6o 44 A2s A4o A3o A2o 33 22"},
  11: {"shovePct":37.2,"callPct":24.6,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s A7o A3s A5o A6o 44 A2s A4o A3o A2o 33 22"},
  12: {"shovePct":35.7,"callPct":24.6,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 K9s A6s A8o QJs A5s KTo A4s A7o A3s A5o A6o 44 A2s A4o A3o A2o 33 22"},
  13: {"shovePct":34.5,"callPct":23.1,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 A6s A8o A5s KTo A4s A7o A3s A5o A6o 44 A2s A4o A2o 33 22"},
  14: {"shovePct":34.5,"callPct":22.2,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 A6s A8o A5s KTo A4s A7o A3s A5o A6o 44 A2s A4o 33 22"},
  15: {"shovePct":32.9,"callPct":19.9,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 A6s A8o A5s A4s A7o A3s A5o A6o 44 A2s 33"},
  16: {"shovePct":31.7,"callPct":17.6,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 A6s A8o A5s A4s A7o A3s 44 A2s"},
  17: {"shovePct":31.7,"callPct":17.6,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 A6s A8o A5s A4s A7o A3s 44 A2s"},
  18: {"shovePct":31.1,"callPct":17.6,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 A6s A8o A5s A4s A7o A3s 44 A2s"},
  19: {"shovePct":30.5,"callPct":17.6,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo KJo A9o 55 A6s A8o A5s A4s A7o A3s 44 A2s"},
  20: {"shovePct":30.5,"callPct":16.4,"call":"AA KK QQ JJ TT 99 88 AKs 77 AQs AJs AKo AQo ATs KQs AJo 66 ATo A9s A8s KJs KTs A7s KQo A9o 55 A6s A8o A5s A4s A7o 44 A2s"},
};

const sets = new Map();
/** Стек в ББ → { call: Set, row } по ближайшей строке (1–20). */
export function huCall(stackBB) {
  const key = Math.min(20, Math.max(1, Math.round(stackBB)));
  if (!sets.has(key)) sets.set(key, { call: new Set(HU_CALL[key].call.split(' ')), row: HU_CALL[key], key });
  return sets.get(key);
}
