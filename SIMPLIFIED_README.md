# 🚀 Flutter Version Checker - Simplified Tag-Based Version Control

A GitHub Action that automatically manages your Flutter app versions by comparing with git tags and auto-incrementing when needed.

## 📋 How It Works

This action follows a simple, tag-based version control strategy:

### Scenario 1: First Time (No Previous Tags)
- ✅ Creates an initial tag from the version in `pubspec.yaml`
- No version bump needed

### Scenario 2: Version SAME as Previous Tag
- ⚠️ Version in `pubspec.yaml` equals the latest git tag
- 🔧 Auto-increments the version (patch + build number)
- 💾 Updates `pubspec.yaml`
- 📝 Commits and pushes the change
- 🏷️ Creates a new tag

### Scenario 3: Version LOWER than Previous Tag
- ⚠️ Version in `pubspec.yaml` is lower than the latest git tag
- 🔧 Auto-increments based on the previous tag
- 💾 Updates `pubspec.yaml`
- 📝 Commits and pushes the change
- 🏷️ Creates a new tag

### Scenario 4: Version HIGHER than Previous Tag
- ✅ Version in `pubspec.yaml` is already higher
- 🏷️ Just creates a new tag
- No version bump needed

## 🎯 Quick Setup

### Step 1: Add to Your Workflow

```yaml
name: Version Control

on:
  push:
    branches:
      - main

jobs:
  version_check:
    runs-on: ubuntu-latest
    
    permissions:
      contents: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Version Check & Auto-Tag
        uses: Abdo-ka/flutter-version-checker@v2
        with:
          branch: ${{ github.ref_name }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Step 2: Configure Permissions

Make sure your workflow has write permissions for contents:

```yaml
permissions:
  contents: write
```

## 📖 Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `branch` | The branch to work with | Yes | `main` |
| `token` | GitHub token for pushing changes | Yes | `${{ github.token }}` |
| `commit-message` | Custom commit message for version updates | No | `🔧 Auto-increment version [skip ci]` |

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `previous-version` | The previous version from the latest tag |
| `current-version` | The current/final version after processing |
| `version-updated` | Whether the version was automatically updated (`true`/`false`) |
| `new-version` | The new version if it was updated |

## 💡 Example Usage

### Basic Usage
```yaml
- name: Version Check
  uses: Abdo-ka/flutter-version-checker@v2
  with:
    branch: main
    token: ${{ secrets.GITHUB_TOKEN }}
```

### With Custom Commit Message
```yaml
- name: Version Check
  uses: Abdo-ka/flutter-version-checker@v2
  with:
    branch: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    commit-message: "chore: bump version for staging release"
```

### Using Outputs
```yaml
- name: Version Check
  id: version
  uses: Abdo-ka/flutter-version-checker@v2
  with:
    branch: main
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Show Version Info
  run: |
    echo "Previous: ${{ steps.version.outputs.previous-version }}"
    echo "Current: ${{ steps.version.outputs.current-version }}"
    echo "Updated: ${{ steps.version.outputs.version-updated }}"
```

## 🔍 How It Compares Versions

The action uses semantic versioning with Flutter's build number format:

```
1.0.0+1
│ │ │ │
│ │ │ └─ Build Number
│ │ └─── Patch Version
│ └───── Minor Version
└─────── Major Version
```

Comparison rules:
1. Compare major.minor.patch using semantic versioning
2. If base versions are equal, compare build numbers

## 📝 Version Increment Strategy

When a version bump is needed, the action increments:
- ✅ Patch version: `+1`
- ✅ Build number: `+1`

Example: `1.0.5+20` → `1.0.6+21`

## 🎭 Real-World Examples

### Example 1: First Release
```
Current pubspec.yaml: 1.0.0+1
Previous tags: (none)
Result: ✅ Create tag v1.0.0+1
```

### Example 2: Forgot to Update Version
```
Current pubspec.yaml: 1.0.0+1
Latest tag: v1.0.0+1
Result: 🔧 Update to 1.0.1+2, commit, push, tag
```

### Example 3: Version Decreased by Mistake
```
Current pubspec.yaml: 1.0.0+1
Latest tag: v1.5.3+15
Result: 🔧 Update to 1.5.4+16, commit, push, tag
```

### Example 4: Already Bumped Manually
```
Current pubspec.yaml: 1.5.4+16
Latest tag: v1.5.3+15
Result: ✅ Create tag v1.5.4+16
```

## ⚙️ Best Practices

1. **Use `[skip ci]` in commit messages** to avoid infinite loops:
   ```yaml
   commit-message: "chore: bump version [skip ci]"
   ```

2. **Fetch full history** for proper tag detection:
   ```yaml
   - uses: actions/checkout@v4
     with:
       fetch-depth: 0
   ```

3. **Refresh checkout** after version updates:
   ```yaml
   - name: Refresh Checkout
     if: steps.version-check.outputs.version-updated == 'true'
     uses: actions/checkout@v4
     with:
       ref: ${{ github.ref_name }}
   ```

4. **Set proper permissions**:
   ```yaml
   permissions:
     contents: write
   ```

## 🚨 Troubleshooting

### Action fails with "GitHub token is required"
Make sure you're passing the token:
```yaml
with:
  token: ${{ secrets.GITHUB_TOKEN }}
```

### Tags not being created
Check that your workflow has write permissions:
```yaml
permissions:
  contents: write
```

### Infinite workflow loops
Use `[skip ci]` in the commit message to prevent re-triggering:
```yaml
commit-message: "chore: bump version [skip ci]"
```

## 📜 License

MIT License - see LICENSE file for details

## 👤 Author

Abd Alrahman Kanawati

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
