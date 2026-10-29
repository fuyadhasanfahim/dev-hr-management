// What every Knowledge Base tab receives from the page: its slice of the URL state (search, page, page size).
export interface ListProps {
    q: string;
    page: number;
    limit: number;
    view: string;
    /** Which AI's traffic to show; undefined = both. Entries are shared, so only questions and replies use it. */
    channel?: 'whatsapp' | 'website';
    onPage: (page: number) => void;
    onLimit: (limit: number) => void;
    onView: (view: string) => void;
}
