export const logger = {
    log: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(...args);
        }
    },
    error: (...args: any[]) => {
        console.error(...args);
    },
    warn: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.warn(...args);
        }
    },
};
