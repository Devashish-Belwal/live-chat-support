const locks = new Map<number, Promise<any>>();

export async function withConversationLock<T>(
    conversationId: number,
    fn: () => Promise<T>,
): Promise<T> {
    const prev = locks.get(conversationId) || Promise.resolve();
    const next = prev.then(() => fn()).finally(() => {
        if (locks.get(conversationId) === next) {
            locks.delete(conversationId);
        }
    });
    locks.set(conversationId, next);
    return next;
}
