import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** False on the server and during hydration, true once the page runs in the browser. */
export function useIsMounted(): boolean {
    return useSyncExternalStore(subscribe, () => true, () => false);
}
