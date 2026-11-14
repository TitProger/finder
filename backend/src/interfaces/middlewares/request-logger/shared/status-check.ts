export const isServerError = (status?: number): boolean => typeof status === 'number' && status >= 500;

export const isClientError = (status?: number): boolean => typeof status === 'number' && status >= 400 && status < 500;
