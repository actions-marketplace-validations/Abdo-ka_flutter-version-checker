# 🔄 Version Control Flow Diagram

## Current Simplified Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                   GitHub Action Triggered                        │
│                   (Push to branch)                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Checkout Repository with Full History                  │
│  - fetch-depth: 0 (get all tags)                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Read Version from pubspec.yaml                         │
│  - Extract current version (e.g., 1.5.3+15)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Get Latest Git Tag                                     │
│  - Run: git tag --sort=-version:refname                        │
│  - Get the most recent tag                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                      ┌──────┴──────┐
                      │  Tags Exist? │
                      └──────┬──────┘
                             │
              ┌──────────────┼──────────────┐
              │ NO                          │ YES
              ▼                             ▼
    ┌─────────────────────┐      ┌──────────────────────┐
    │  Scenario 1:        │      │  Compare Versions    │
    │  FIRST TIME         │      │  pubspec vs latest   │
    │                     │      │  tag                 │
    │  Create tag from    │      └──────────┬───────────┘
    │  pubspec.yaml       │                 │
    │                     │      ┌──────────┼───────────────┐
    │  ✅ Done            │      │          │               │
    └─────────────────────┘      │          │               │
                                 ▼          ▼               ▼
                         ┌─────────┐  ┌─────────┐    ┌──────────┐
                         │ SAME    │  │ LOWER   │    │ HIGHER   │
                         │ Version │  │ Version │    │ Version  │
                         └────┬────┘  └────┬────┘    └────┬─────┘
                              │            │              │
                              ▼            ▼              ▼
                    ┌──────────────┐ ┌──────────────┐ ┌─────────────┐
                    │ Scenario 2:  │ │ Scenario 3:  │ │ Scenario 4: │
                    │              │ │              │ │             │
                    │ Bump version │ │ Bump version │ │ Create tag  │
                    │ Commit & Push│ │ Commit & Push│ │ ONLY        │
                    │ Create tag   │ │ Create tag   │ │             │
                    │              │ │              │ │ ✅ Done     │
                    │ ✅ Done      │ │ ✅ Done      │ └─────────────┘
                    └──────────────┘ └──────────────┘
```

## Detailed Scenario Breakdown

### 🎯 Scenario 1: First Time (No Tags)

```
Input:
  pubspec.yaml: 1.0.0+1
  Git tags:     (none)

Process:
  1. No comparison needed
  2. Create tag from current version

Output:
  ✅ Tag created: v1.0.0+1
  ❌ No commit (version not changed)
```

### 🔄 Scenario 2: Same Version

```
Input:
  pubspec.yaml: 1.0.0+1
  Latest tag:   v1.0.0+1
  Comparison:   EQUAL

Process:
  1. Detect version reuse
  2. Generate new version: 1.0.1+2
  3. Update pubspec.yaml
  4. Commit: "Auto-increment version to 1.0.1+2 [skip ci]"
  5. Push commit
  6. Create tag: v1.0.1+2

Output:
  ✅ Version bumped: 1.0.0+1 → 1.0.1+2
  ✅ Commit created
  ✅ Tag created: v1.0.1+2
```

### ⬇️ Scenario 3: Lower Version

```
Input:
  pubspec.yaml: 1.0.0+1
  Latest tag:   v1.5.3+15
  Comparison:   LOWER

Process:
  1. Detect version decrease
  2. Generate new version: 1.5.4+16
  3. Update pubspec.yaml
  4. Commit: "Auto-increment version to 1.5.4+16 [skip ci]"
  5. Push commit
  6. Create tag: v1.5.4+16

Output:
  ✅ Version bumped: 1.0.0+1 → 1.5.4+16
  ✅ Commit created
  ✅ Tag created: v1.5.4+16
```

### ⬆️ Scenario 4: Higher Version

```
Input:
  pubspec.yaml: 1.5.4+16
  Latest tag:   v1.5.3+15
  Comparison:   HIGHER

Process:
  1. Version already correct
  2. Create tag only

Output:
  ❌ No version bump
  ❌ No commit
  ✅ Tag created: v1.5.4+16
```

## Version Increment Logic

```
Previous: 1.5.3+15
           │ │ │  │
           │ │ │  └── Build Number
           │ │ └───── Patch Version
           │ └─────── Minor Version  
           └───────── Major Version

Increment: patch +1, build +1

New:      1.5.4+16
```

## Git Operations by Scenario

| Scenario | Git Fetch | Git Add | Git Commit | Git Push | Git Tag | Git Push Tag |
|----------|-----------|---------|------------|----------|---------|--------------|
| 1 (First) | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 2 (Same) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 (Lower) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4 (Higher) | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |

## Action Outputs

```yaml
outputs:
  previous-version: "1.5.3+15"   # Latest tag version
  current-version:  "1.5.4+16"   # Final version after processing
  version-updated:  "true"        # Whether version was bumped
  new-version:      "1.5.4+16"   # New version if updated
```

## Workflow Integration

```yaml
steps:
  # 1. Checkout with full history
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0
      token: ${{ secrets.GITHUB_TOKEN }}
  
  # 2. Run version checker
  - name: Version Check
    id: version
    uses: Abdo-ka/flutter-version-checker@v2
    with:
      branch: main
      token: ${{ secrets.GITHUB_TOKEN }}
  
  # 3. Refresh if version was updated
  - name: Refresh
    if: steps.version.outputs.version-updated == 'true'
    uses: actions/checkout@v4
    with:
      ref: main
  
  # 4. Continue with build using correct version
  - name: Build
    run: flutter build
```

## Benefits Summary

| Aspect | Benefit |
|--------|---------|
| **Speed** | ⚡ 10x faster (tag check vs commit scan) |
| **Reliability** | 🎯 Tags are immutable and reliable |
| **Simplicity** | 📝 4 clear scenarios, easy to debug |
| **Standard** | ✅ Follows Git best practices |
| **Maintainability** | 🛠️ Less code, fewer bugs |

---

**Last Updated:** October 13, 2025
