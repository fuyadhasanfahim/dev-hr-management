// What a failed API call looks like when it reaches a catch block (RTK Query `unwrap()` throws the response).
export interface ApiError {
    data?: { message?: string; errors?: Record<string, string[]> };
    errors?: Record<string, string[]>;
    message?: string;
    status?: number;
}

const asApiError = (err: unknown): ApiError => (typeof err === 'object' && err !== null ? (err as ApiError) : {});

export const apiMessage = (err: unknown, fallback: string): string => {
    const e = asApiError(err);
    return e.data?.message || e.message || fallback;
};

export const apiFieldErrors = (err: unknown): Record<string, string[]> | undefined => {
    const e = asApiError(err);
    return e.data?.errors || e.errors;
};
