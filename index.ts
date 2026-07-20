import { Context } from 'hydrooj';

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

export async function apply(ctx: Context) {
    ctx.on('contest/scoreboard', (tdoc: any, rows: ScoreboardRow[], udict: Record<number, any>) => {
        optimiseIoiScoreboard(tdoc, rows, udict);
    });
}
