'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function profilesDir() {
  return process.env.CLAUDE_PROFILES_DIR || path.join(os.homedir(), '.claude-profiles');
}

function profileBase(profile) {
  return path.join(profilesDir(), profile);
}

function tokenPath(profile) {
  return path.join(profileBase(profile), 'token');
}

function configDir(profile) {
  return path.join(profileBase(profile), 'config');
}

function listProfiles() {
  try {
    return fs.readdirSync(profilesDir()).filter((name) => {
      return fs.statSync(path.join(profilesDir(), name)).isDirectory();
    });
  } catch {
    return [];
  }
}

module.exports = { profilesDir, profileBase, tokenPath, configDir, listProfiles };
