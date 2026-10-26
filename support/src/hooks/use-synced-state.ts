import { useState, type Dispatch, type SetStateAction } from 'react';

/**
 * State that follows a source value (a prop, the URL…): it takes the source whenever the source changes and can
 * be edited locally in between. The reset happens while rendering (React's "adjusting state when a prop changes"),
 * not in an effect, so there is never a render showing the old value.
 */
export function useSyncedState<T>(source: T): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState(source);
    const [seen, setSeen] = useState(source);
    if (!Object.is(seen, source)) {
        setSeen(source);
        setValue(source);
    }
    return [value, setValue];
}
