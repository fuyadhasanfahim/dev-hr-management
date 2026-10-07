// A startup failure that nobody catches (e.g. MongoDB not answering in time
// while lib/auth.ts awaits its client at import) leaves the process "online"
// in pm2 but never listening. Exit instead, so pm2 restarts it and retries.
// Lifted once the server is listening — after that, normal handling applies.
const exitOnBootFailure = (err: unknown) => {
    console.error('boot.failed', err);
    process.exit(1);
};
process.on('unhandledRejection', exitOnBootFailure);

export const bootDone = () => process.off('unhandledRejection', exitOnBootFailure);
