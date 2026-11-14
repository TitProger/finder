import { LogMeta, SourceContext } from './logger.context';

const INTERNAL_STACK_MARKERS = [
    'common/logger/logger',
    'common\\logger\\logger',
    'common/logger/source-meta.helper',
    'common\\logger\\source-meta.helper',
];

function isInternalFrame(line: string): boolean {
    return INTERNAL_STACK_MARKERS.some((marker) => line.includes(marker));
}

function parseStackLine(line: string): Pick<SourceContext, 'file' | 'function' | 'line'> | undefined {
    const trimmed = line.trim();

    if (!trimmed.startsWith('at')) {
        return undefined;
    }

    const functionMatch = trimmed.match(/^\s*at\s+(?<fn>.+?)\s+\(/);
    const functionName = functionMatch?.groups?.fn?.trim();

    const locationSegmentIndex = trimmed.lastIndexOf('(');
    const locationSegment =
        locationSegmentIndex >= 0 ? trimmed.slice(locationSegmentIndex + 1) : trimmed.replace(/^\s*at\s+/, '');
    const locationMatch = locationSegment.match(/(?<file>.*):(?<line>\d+):\d+\)?$/);

    if (!locationMatch?.groups) {
        return undefined;
    }

    const file = locationMatch.groups.file?.trim();
    const lineNumber = Number(locationMatch.groups.line);

    if (!file || Number.isNaN(lineNumber)) {
        return undefined;
    }

    return {
        file,
        function: functionName,
        line: lineNumber,
    };
}

function inferSourceFromStack(): Pick<SourceContext, 'file' | 'function' | 'line'> | undefined {
    const error = new Error();

    if (!error.stack) {
        return undefined;
    }

    const lines = error.stack.split('\n').slice(1);

    for (const rawLine of lines) {
        if (isInternalFrame(rawLine)) {
            continue;
        }

        const parsed = parseStackLine(rawLine);

        if (parsed) {
            return parsed;
        }
    }

    return undefined;
}

export function enrichMetaWithSource(meta: LogMeta | undefined): LogMeta | undefined {
    const inferred = inferSourceFromStack();
    const existingSource = meta?.source ?? {};
    const source: SourceContext = {
        ...inferred,
        ...existingSource,
    };

    const hasSource = Object.values(source).some((value) => value !== undefined && value !== null);

    if (!hasSource) {
        return meta;
    }

    return {
        ...(meta ?? {}),
        source,
    };
}
