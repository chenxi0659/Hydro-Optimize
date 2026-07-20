import { Context, RecordModel } from 'hydrooj';

type ScoreboardNode = {
    type: string;
    value: string;
    raw?: any;
    score?: number;
};

type ScoreboardRow = ScoreboardNode[];

type RankedRow = {
    row: ScoreboardRow;
    score: number;
    elapsedSeconds: number;
    username: string;
};

type SubmissionCountMap = Map<string, number>;

function submissionCountKey(uid: number, pid: number): string {
    return `${uid}/${pid}`;
}

function getRecordTimestamp(raw: any): number | null {
    if (!raw) return null;
    if (typeof raw.getTimestamp === 'function') return raw.getTimestamp().getTime();
    if (raw.$oid && typeof raw.$oid === 'string') {
        return parseInt(raw.$oid.slice(0, 8), 16) * 1000;
    }
    return null;
}

function getCellTimestamp(cell: ScoreboardNode): number | null {
    if (cell.type === 'records' && Array.isArray(cell.raw)) {
        // Hydro uses the first record as the score visible on the contest scoreboard.
        return getRecordTimestamp(cell.raw[0]?.raw);
    }
    return getRecordTimestamp(cell.raw);
}

function formatElapsed(seconds: number): string {
    if (!Number.isFinite(seconds)) return '-';
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safeSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((safeSeconds % 3600) / 60).toString().padStart(2, '0');
    const rest = (safeSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${rest}`;
}

function compareUsername(left: string, right: string): number {
    return left.localeCompare(right, 'zh-Hans-CN', { numeric: true, sensitivity: 'variant' });
}

/**
 * Reorders a completed IOI scoreboard without changing persisted contest data.
 * The time for a total score is the latest accepted timestamp among the
 * positive-score records that form the displayed total.
 */
export function optimiseIoiScoreboard(tdoc: any, rows: ScoreboardRow[], udict: Record<number, any>) {
    if (tdoc.rule !== 'ioi' || rows.length < 2) return;

    const header = rows[0];
    const rankIndex = header.findIndex((node) => node.type === 'rank');
    const userIndex = header.findIndex((node) => node.type === 'user');
    const totalScoreIndex = header.findIndex((node) => node.type === 'total_score');
    if (rankIndex < 0 || userIndex < 0 || totalScoreIndex < 0) return;

    const beginAt = new Date(tdoc.beginAt).getTime();
    if (!Number.isFinite(beginAt)) return;

    const rankedRows: RankedRow[] = rows.slice(1).map((row) => {
        const totalNode = row[totalScoreIndex];
        const score = Number(totalNode?.value) || 0;
        const uid = row[userIndex]?.raw;
        const username = String(udict[uid]?.uname || row[userIndex]?.value || '');
        let reachedAt = score > 0 ? 0 : beginAt;

        if (score > 0) {
            for (let index = totalScoreIndex + 1; index < row.length; index++) {
                const cell = row[index];
                // Zero-score submissions do not contribute to reaching the displayed total.
                if (!cell || (cell.score || 0) <= 0) continue;
                const timestamp = getCellTimestamp(cell);
                if (timestamp && timestamp > reachedAt) reachedAt = timestamp;
            }
        }

        const elapsedSeconds = score > 0 && !reachedAt
            ? Number.POSITIVE_INFINITY
            : Math.max(0, Math.floor((reachedAt - beginAt) / 1000));
        totalNode.value = `${score}\n${formatElapsed(elapsedSeconds)}`;
        return { row, score, elapsedSeconds, username };
    });

    const totalHeader = header[totalScoreIndex];
    if (!totalHeader.value.includes('\n')) totalHeader.value = `${totalHeader.value}\n用时`;

    rankedRows.sort((left, right) => (
        right.score - left.score
        || left.elapsedSeconds - right.elapsedSeconds
        || compareUsername(left.username, right.username)
    ));

    let previousScore: number | undefined;
    let previousElapsed: number | undefined;
    let rank = 0;
    for (let index = 0; index < rankedRows.length; index++) {
        const current = rankedRows[index];
        if (current.score !== previousScore || current.elapsedSeconds !== previousElapsed) rank = index + 1;
        current.row[rankIndex].value = String(rank);
        previousScore = current.score;
        previousElapsed = current.elapsedSeconds;
    }

    rows.splice(1, rankedRows.length, ...rankedRows.map((entry) => entry.row));
}

function appendSubmissionCount(value: string, count: number): string {
    if (!count) return value;
    return `${value} <span style="color:#8a8a8a;font:inherit">(${count})</span>`;
}

export function addIoiSubmissionCounts(rows: ScoreboardRow[], counts: SubmissionCountMap) {
    if (rows.length < 2) return;
    const header = rows[0];
    const userIndex = header.findIndex((node) => node.type === 'user');
    const totalScoreIndex = header.findIndex((node) => node.type === 'total_score');
    if (userIndex < 0 || totalScoreIndex < 0) return;

    // Only normal web scoreboards have problem columns. Export views retain plain values.
    const showStyledProblemCounts = header.some((node) => node.type === 'problem');
    if (!showStyledProblemCounts) return;
    for (const row of rows.slice(1)) {
        const uid = Number(row[userIndex]?.raw);
        if (!Number.isSafeInteger(uid)) continue;

        let totalCount = 0;
        for (let index = totalScoreIndex + 1; index < header.length; index++) {
            const pid = Number(header[index]?.raw);
            if (!Number.isSafeInteger(pid)) continue;
            const count = counts.get(submissionCountKey(uid, pid)) || 0;
            totalCount += count;
            if (!count) continue;

            const cell = row[index];
            if (!cell) continue;
            if (cell.type === 'records' && Array.isArray(cell.raw) && cell.raw.length) {
                const visibleRecord = cell.raw[cell.raw.length - 1];
                visibleRecord.value = appendSubmissionCount(String(visibleRecord.value || ''), count);
            } else if (cell.type === 'record') {
                cell.value = appendSubmissionCount(String(cell.value || ''), count);
            }
        }

        const totalNode = row[totalScoreIndex];
        if (!totalNode) continue;
        const [score, ...timeLines] = String(totalNode.value || '').split('\n');
        totalNode.value = `${score} (${totalCount})${timeLines.length ? `\n${timeLines.join('\n')}` : ''}`;
    }
}

async function getIoiSubmissionCounts(tdoc: any, rows: ScoreboardRow[]): Promise<SubmissionCountMap> {
    const header = rows[0] || [];
    const userIndex = header.findIndex((node) => node.type === 'user');
    if (userIndex < 0) return new Map();
    const uids = rows.slice(1)
        .map((row) => Number(row[userIndex]?.raw))
        .filter((uid) => Number.isSafeInteger(uid));
    if (!uids.length || !tdoc.pids?.length) return new Map();

    const result = await RecordModel.coll.aggregate([
        {
            $match: {
                domainId: tdoc.domainId,
                contest: tdoc.docId,
                uid: { $in: uids },
                pid: { $in: tdoc.pids },
            },
        },
        { $group: { _id: { uid: '$uid', pid: '$pid' }, count: { $sum: 1 } } },
    ]).toArray();

    const counts: SubmissionCountMap = new Map();
    for (const item of result) counts.set(submissionCountKey(item._id.uid, item._id.pid), item.count);
    return counts;
}

export async function apply(ctx: Context) {
    ctx.on('contest/scoreboard', async (tdoc: any, rows: ScoreboardRow[], udict: Record<number, any>) => {
        if (tdoc.rule !== 'ioi') return;
        optimiseIoiScoreboard(tdoc, rows, udict);
        addIoiSubmissionCounts(rows, await getIoiSubmissionCounts(tdoc, rows));
    });
}
