/** First strong isolate: the value keeps its own direction, so Latin text can't reorder an Arabic line or move its full stop. */
export const isolate = (text: string): string => `\u2068${text}\u2069`
