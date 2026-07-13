const { join } = require('path');

/**
 * Pins the downloaded Chrome binary to a project-local path instead of the
 * OS user cache (~/.cache/puppeteer on Linux, %USERPROFILE%\.cache\puppeteer
 * on Windows). That per-user cache is what goes missing on a fresh machine,
 * a redeployed VPS, or a container rebuild — causing the
 * "Could not find Chrome" error. Keeping it inside the repo means
 * `npm install` (which runs the postinstall below) always re-downloads it
 * to the same predictable place, on any machine.
 *
 * @type {import('puppeteer').Configuration}
 */
module.exports = {
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
