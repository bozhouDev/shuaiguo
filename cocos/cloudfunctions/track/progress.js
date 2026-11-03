// 自动生成：npm run cloud:prepare；勿手改。
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeProgress = exports.isBetterBest = void 0;
// 星级优先；同星时新记录用总账，旧记录没有总账则用背锅次数；平手保留已有值。
function isBetterBest(candidate, old) {
    var _a, _b, _c, _d;
    return candidate.stars > 0 && (!old || candidate.stars > old.stars ||
        candidate.stars === old.stars && ((_b = (_a = candidate.debt) !== null && _a !== void 0 ? _a : candidate.blames) !== null && _b !== void 0 ? _b : Infinity) < ((_d = (_c = old.debt) !== null && _c !== void 0 ? _c : old.blames) !== null && _d !== void 0 ? _d : Infinity));
}
exports.isBetterBest = isBetterBest;
// 合并只增加进度；称呼独立按修改时间选取，无时间戳的旧档视为0，平手保留已有称呼。
function mergeProgress(current, incoming) {
    const out = JSON.parse(JSON.stringify(current));
    out.unlocked = Math.max(current.unlocked, incoming.unlocked);
    out.best = { ...current.best };
    for (const [id, best] of Object.entries(incoming.best))
        if (isBetterBest(best, out.best[+id]))
            out.best[+id] = { ...best };
    if (current.tutDone || incoming.tutDone)
        out.tutDone = true;
    if (current.achievements || incoming.achievements) {
        out.achievements = { ...current.achievements };
        for (const [key, value] of Object.entries(incoming.achievements || {}))
            out.achievements[key] = !!(out.achievements[key] || value);
    }
    if (incoming.bossName !== undefined && (current.bossName === undefined || (incoming.bossNameAt || 0) > (current.bossNameAt || 0))) {
        out.bossName = incoming.bossName;
        out.bossNameAt = incoming.bossNameAt || 0;
    }
    return out;
}
exports.mergeProgress = mergeProgress;
