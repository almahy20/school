const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for Node.js v24 compatibility with jest-worker
config.maxWorkers = 1;

// Ensure proper resolver for path aliases
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;
