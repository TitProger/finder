/** Ниже лимита Telegram в 4096, чтобы разрез по строке не упирался в границу. */
export const TELEGRAM_TEXT_LIMIT = 4000;

export function splitTelegramText(text: string, limit = TELEGRAM_TEXT_LIMIT): string[] {
    const source = text.trim();

    if (source.length <= limit) {
        return [source];
    }

    const chunks: string[] = [];
    let rest = source;

    while (rest.length > limit) {
        const newline = rest.lastIndexOf('\n', limit);
        const at = newline > 200 ? newline : limit;

        chunks.push(rest.slice(0, at).trimEnd());
        rest = rest.slice(at).trimStart();
    }

    if (rest) {
        chunks.push(rest);
    }

    return chunks;
}
