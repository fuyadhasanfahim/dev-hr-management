import { useState } from 'react';

export interface Command {
    label: string;
    undo: () => Promise<unknown>;
    redo: () => Promise<unknown>;
}

/** Linear undo/redo stack. Only reversible edits (list items, text, node positions) are recorded. */
export function useHistory(max = 50) {
    const [past, setPast] = useState<Command[]>([]);
    const [future, setFuture] = useState<Command[]>([]);
    const [busy, setBusy] = useState(false);

    const record = (cmd: Command) => {
        setPast((p) => [...p.slice(-(max - 1)), cmd]);
        setFuture([]);
    };

    const undo = async () => {
        const cmd = past[past.length - 1];
        if (!cmd || busy) return null;
        setBusy(true);
        try {
            await cmd.undo();
            setPast(past.slice(0, -1));
            setFuture([cmd, ...future]);
            return cmd;
        } finally {
            setBusy(false);
        }
    };

    const redo = async () => {
        const cmd = future[0];
        if (!cmd || busy) return null;
        setBusy(true);
        try {
            await cmd.redo();
            setFuture(future.slice(1));
            setPast([...past, cmd]);
            return cmd;
        } finally {
            setBusy(false);
        }
    };

    return { record, undo, redo, canUndo: past.length > 0 && !busy, canRedo: future.length > 0 && !busy, nextUndo: past[past.length - 1]?.label, nextRedo: future[0]?.label };
}
