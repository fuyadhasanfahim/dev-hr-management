// Runs async jobs one after another per key, so two updates of the same record never overlap or overwrite each other.
const tails = new Map<string, Promise<unknown>>();

export function runInOrder<T>(key: string, job: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(job);
    tails.set(key, next);
    void next.then(
        () => tails.get(key) === next && tails.delete(key),
        () => tails.get(key) === next && tails.delete(key),
    );
    return next;
}

/** Waits for the jobs already queued under `key`, but never longer than `maxMs`. */
export function waitForKey(key: string, maxMs: number): Promise<void> {
    const tail = tails.get(key);
    if (!tail) return Promise.resolve();
    return Promise.race([tail.then(() => undefined, () => undefined), new Promise<void>((resolve) => setTimeout(resolve, maxMs))]);
}
