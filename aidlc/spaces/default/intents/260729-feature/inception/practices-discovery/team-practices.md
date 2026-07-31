# Team Practices

Status: affirmed through the practices-discovery interview.

## Way of Working

Use trunk-based development. Work in short-lived feature branches and squash-merge them to `main`.

## Walking Skeleton

Use a scope-dependent walking skeleton: run a gated skeleton only when the active scope enables it.

## Testing Posture

Write tests alongside code. Maintain at least 80% line coverage and require green CI before merge.

## Deployment

Continuously deploy to production after all automated gates pass.

## Code Style

Use the repository formatter and linter, and follow idiomatic TypeScript. Do not add further team conventions until the repository tooling is established.
