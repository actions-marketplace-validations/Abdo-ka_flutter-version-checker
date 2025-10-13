const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
const fs = require('fs');
const yaml = require('js-yaml');
const semver = require('semver');

/**
 * Parse a Flutter version string (e.g., "1.0.0+1")
 * @param {string} versionStr - The version string
 * @returns {object} - Parsed version object
 */
function parseFlutterVersion(versionStr) {
  if (!versionStr) return null;
  
  const parts = versionStr.split('+');
  const baseParts = parts[0].split('.');
  const buildNumber = parts[1] ? parseInt(parts[1], 10) : 0;
  
  return {
    major: parseInt(baseParts[0], 10) || 0,
    minor: parseInt(baseParts[1], 10) || 0,
    patch: parseInt(baseParts[2], 10) || 0,
    build: buildNumber,
    base: parts[0],
    full: versionStr
  };
}

/**
 * Compare two Flutter versions
 * @param {string} current - Current version
 * @param {string} previous - Previous version
 * @returns {number} - 1 if current > previous, 0 if equal, -1 if current < previous
 */
function compareVersions(current, previous) {
  const currentParsed = parseFlutterVersion(current);
  const previousParsed = parseFlutterVersion(previous);
  
  if (!currentParsed || !previousParsed) return 0;
  
  // Compare base version using semver
  const baseComparison = semver.compare(currentParsed.base, previousParsed.base);
  
  if (baseComparison !== 0) {
    return baseComparison;
  }
  
  // Same base version, compare build numbers
  if (currentParsed.build > previousParsed.build) return 1;
  if (currentParsed.build < previousParsed.build) return -1;
  return 0;
}

/**
 * Generate next version by incrementing patch and build number
 * @param {string} previousVersion - The previous version
 * @returns {string} - The next version
 */
function generateNextVersion(previousVersion) {
  const parsed = parseFlutterVersion(previousVersion);
  if (!parsed) return '1.0.0+1';
  
  // Increment patch version and build number
  const newPatch = parsed.patch + 1;
  const newBuild = parsed.build + 1;
  
  return `${parsed.major}.${parsed.minor}.${newPatch}+${newBuild}`;
}

/**
 * Get the current version from pubspec.yaml
 * @param {string} pubspecPath - Path to pubspec.yaml
 * @returns {string|null} - Current version or null
 */
function getCurrentVersion(pubspecPath) {
  try {
    const content = fs.readFileSync(pubspecPath, 'utf8');
    const doc = yaml.load(content);
    return doc.version || null;
  } catch (error) {
    core.error(`Error reading pubspec.yaml: ${error.message}`);
    return null;
  }
}

/**
 * Update the version in pubspec.yaml
 * @param {string} pubspecPath - Path to pubspec.yaml
 * @param {string} newVersion - New version string
 * @returns {boolean} - Success status
 */
function updatePubspecVersion(pubspecPath, newVersion) {
  try {
    const content = fs.readFileSync(pubspecPath, 'utf8');
    const doc = yaml.load(content);
    doc.version = newVersion;
    
    const newContent = yaml.dump(doc, { 
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false
    });
    
    fs.writeFileSync(pubspecPath, newContent, 'utf8');
    core.info(`✅ Updated pubspec.yaml with version: ${newVersion}`);
    return true;
  } catch (error) {
    core.error(`Error updating pubspec.yaml: ${error.message}`);
    return false;
  }
}

/**
 * Execute git command and return output
 * @param {string[]} args - Git command arguments
 * @param {boolean} throwOnError - Whether to throw on error
 * @returns {string} - Command output
 */
async function execGit(args, throwOnError = false) {
  let output = '';
  let error = '';
  
  const options = {
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
      stderr: (data) => {
        error += data.toString();
      }
    },
    silent: true,
    ignoreReturnCode: !throwOnError
  };
  
  const exitCode = await exec.exec('git', args, options);
  
  if (exitCode !== 0 && throwOnError) {
    throw new Error(`Git command failed: git ${args.join(' ')}\nError: ${error}`);
  }
  
  return output.trim();
}

/**
 * Get the latest tag from git
 * @returns {string|null} - Latest tag version or null if no tags exist
 */
async function getLatestTag() {
  try {
    // Fetch all tags from remote
    await execGit(['fetch', '--tags'], false);
    
    // Get the latest tag sorted by version
    const tags = await execGit(['tag', '--sort=-version:refname'], false);
    
    if (!tags) {
      core.info('No previous tags found - this is the first release');
      return null;
    }
    
    // Get the first tag (latest)
    const latestTag = tags.split('\n')[0].trim();
    
    if (!latestTag) {
      core.info('No previous tags found - this is the first release');
      return null;
    }
    
    // Remove 'v' prefix if present
    const version = latestTag.startsWith('v') ? latestTag.substring(1) : latestTag;
    core.info(`📌 Found latest tag: ${latestTag} (version: ${version})`);
    
    return version;
  } catch (error) {
    core.warning(`Error getting latest tag: ${error.message}`);
    return null;
  }
}

/**
 * Configure git for committing
 * @param {string} token - GitHub token for authentication
 */
async function configureGit(token) {
  try {
    // Configure git user
    await execGit(['config', '--local', 'user.email', 'action@github.com'], true);
    await execGit(['config', '--local', 'user.name', 'GitHub Action'], true);
    
    // Configure authentication
    if (token) {
      const remoteUrl = await execGit(['config', '--get', 'remote.origin.url']);
      if (remoteUrl) {
        const match = remoteUrl.match(/github\.com[\/:](.+?)(?:\.git)?$/);
        if (match) {
          const repo = match[1];
          const authenticatedUrl = `https://x-access-token:${token}@github.com/${repo}.git`;
          await execGit(['remote', 'set-url', 'origin', authenticatedUrl], true);
          core.info('✅ Git authentication configured');
        }
      }
    }
  } catch (error) {
    core.error(`Failed to configure git: ${error.message}`);
    throw error;
  }
}

/**
 * Create and push a git tag
 * @param {string} version - Version to tag
 * @param {string} token - GitHub token
 */
async function createAndPushTag(version, token) {
  try {
    await configureGit(token);
    
    const tagName = `v${version}`;
    
    // Check if tag already exists
    const existingTag = await execGit(['tag', '-l', tagName], false);
    if (existingTag) {
      core.info(`ℹ️  Tag ${tagName} already exists, skipping tag creation`);
      return;
    }
    
    core.info(`🏷️  Creating tag ${tagName}...`);
    await execGit(['tag', '-a', tagName, '-m', `Release ${tagName}`], true);
    
    core.info(`📤 Pushing tag ${tagName}...`);
    await execGit(['push', 'origin', tagName], true);
    
    core.info(`✅ Successfully created and pushed tag ${tagName}`);
  } catch (error) {
    core.error(`Failed to create/push tag: ${error.message}`);
    throw error;
  }
}

/**
 * Commit and push version changes, then create tag
 * @param {string} branch - Target branch
 * @param {string} newVersion - New version
 * @param {string} previousVersion - Previous version
 * @param {string} customMessage - Custom commit message
 * @param {string} token - GitHub token
 */
async function commitPushAndTag(branch, newVersion, previousVersion, customMessage, token) {
  try {
    await configureGit(token);
    
    const commitMessage = customMessage || `🔧 Auto-increment version to ${newVersion}

Previous version: ${previousVersion}
New version: ${newVersion}
[skip ci]`;

    // Check if there are changes to commit
    const status = await execGit(['status', '--porcelain']);
    if (!status) {
      core.info('ℹ️  No changes to commit');
      return;
    }

    core.info('📝 Staging pubspec.yaml...');
    await execGit(['add', 'pubspec.yaml'], true);
    
    core.info('💾 Committing version update...');
    await execGit(['commit', '-m', commitMessage], true);
    
    core.info(`📤 Pushing to ${branch}...`);
    await execGit(['push', 'origin', `HEAD:${branch}`], true);
    
    // Create and push tag
    await createAndPushTag(newVersion, token);
    
    core.info('✅ Successfully committed, pushed, and tagged');
  } catch (error) {
    core.error(`Failed to commit/push: ${error.message}`);
    throw error;
  }
}

/**
 * Main action function
 */
async function run() {
  try {
    // Get inputs
    const branch = core.getInput('branch') || 'main';
    const token = core.getInput('token');
    const customMessage = core.getInput('commit-message');
    const pubspecPath = 'pubspec.yaml';
    
    core.info('🚀 Flutter Version Checker & Auto-Increment Action');
    core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Validate token
    if (!token) {
      core.setFailed('❌ GitHub token is required');
      return;
    }
    
    // Check if pubspec.yaml exists
    if (!fs.existsSync(pubspecPath)) {
      core.setFailed(`❌ pubspec.yaml not found at ${pubspecPath}`);
      return;
    }
    
    // Get current version from pubspec.yaml
    const currentVersion = getCurrentVersion(pubspecPath);
    if (!currentVersion) {
      core.setFailed('❌ Could not read version from pubspec.yaml');
      return;
    }
    
    core.info(`📦 Current version in pubspec.yaml: ${currentVersion}`);
    
    // Get latest tag from git
    const previousTagVersion = await getLatestTag();
    
    // SCENARIO 1: First time - No previous tags exist
    if (!previousTagVersion) {
      core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      core.info('📌 SCENARIO: First Release');
      core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      core.info(`✅ Creating initial tag with version: ${currentVersion}`);
      
      await createAndPushTag(currentVersion, token);
      
      core.setOutput('previous-version', 'none');
      core.setOutput('current-version', currentVersion);
      core.setOutput('version-updated', 'false');
      core.setOutput('new-version', currentVersion);
      
      core.info('🎉 Initial tag created successfully!');
      return;
    }
    
    core.info(`� Previous tag version: ${previousTagVersion}`);
    core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Compare versions
    const comparison = compareVersions(currentVersion, previousTagVersion);
    
    // SCENARIO 2: Same version - Update and create new tag
    if (comparison === 0) {
      core.info('� SCENARIO: Version is SAME as previous tag');
      core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      core.warning(`⚠️  Version ${currentVersion} equals previous tag ${previousTagVersion}`);
      
      const newVersion = generateNextVersion(currentVersion);
      core.info(`� Auto-incrementing: ${currentVersion} → ${newVersion}`);
      
      // Update pubspec.yaml
      if (!updatePubspecVersion(pubspecPath, newVersion)) {
        core.setFailed('❌ Failed to update pubspec.yaml');
        return;
      }
      
      // Commit, push, and create tag
      await commitPushAndTag(branch, newVersion, currentVersion, customMessage, token);
      
      core.setOutput('previous-version', previousTagVersion);
      core.setOutput('current-version', newVersion);
      core.setOutput('version-updated', 'true');
      core.setOutput('new-version', newVersion);
      
      core.info('🎉 Version updated, committed, pushed, and tagged!');
      return;
    }
    
    // SCENARIO 3: Lower version - Update and create new tag
    if (comparison < 0) {
      core.info('📌 SCENARIO: Version is LOWER than previous tag');
      core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      core.warning(`⚠️  Version ${currentVersion} is lower than previous tag ${previousTagVersion}`);
      
      const newVersion = generateNextVersion(previousTagVersion);
      core.info(`� Auto-incrementing: ${currentVersion} → ${newVersion}`);
      
      // Update pubspec.yaml
      if (!updatePubspecVersion(pubspecPath, newVersion)) {
        core.setFailed('❌ Failed to update pubspec.yaml');
        return;
      }
      
      // Commit, push, and create tag
      await commitPushAndTag(branch, newVersion, previousTagVersion, customMessage, token);
      
      core.setOutput('previous-version', previousTagVersion);
      core.setOutput('current-version', newVersion);
      core.setOutput('version-updated', 'true');
      core.setOutput('new-version', newVersion);
      
      core.info('🎉 Version updated, committed, pushed, and tagged!');
      return;
    }
    
    // SCENARIO 4: Higher version - Just create tag
    if (comparison > 0) {
      core.info('📌 SCENARIO: Version is HIGHER than previous tag');
      core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      core.info(`✅ Version ${currentVersion} is higher than previous tag ${previousTagVersion}`);
      core.info('📝 No version bump needed, creating tag only...');
      
      await createAndPushTag(currentVersion, token);
      
      core.setOutput('previous-version', previousTagVersion);
      core.setOutput('current-version', currentVersion);
      core.setOutput('version-updated', 'false');
      core.setOutput('new-version', currentVersion);
      
      core.info('🎉 Tag created successfully!');
      return;
    }
    
  } catch (error) {
    core.setFailed(`❌ Action failed: ${error.message}`);
    core.debug(`Stack trace: ${error.stack}`);
  }
}

// Run the action
if (require.main === module) {
  run();
}

module.exports = {
  run,
  parseFlutterVersion,
  compareVersions,
  generateNextVersion
};
