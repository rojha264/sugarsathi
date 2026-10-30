// The API server and the admin panel are separate projects in this repo; keep Metro out of them.
// Sentry's wrapper adds debug ids to bundles so crash stack traces map back to source.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const config = getSentryExpoConfig(__dirname);
const ignore = ['server', 'admin', 'certs'].map((d) => new RegExp(`^${path.join(__dirname, d).replace(/[/\\]/g, '[/\\\\]')}[/\\\\].*`));
config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), ...ignore];
module.exports = config;
