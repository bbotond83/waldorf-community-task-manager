# F4 checklist: remove the real workbook from the git history

Written 2026-10-27 for the repository owner (Botond). Only the owner runs these steps. The assistant never rewrites history, never force-pushes and never touches the remote.

## Why

- File: `source-materials/waldorf-community-app/Ovis tábla v2.xlsx` (about 540 KB).
- Added in commit `035ded3` ("Add AI DLC V2 Inception Artifacts", 2026-08-05); stopped being tracked in `8f8050f`. It is not on `main` any more, but anyone with a clone or read access to the remote can still recover it from the history.
- The owner confirmed on 2026-10-27 that it **contains real personal data** of community members. Treat it as urgent and keep the repository private until the rewrite is done.
- Facts at the time of writing: repository is private, 0 forks, pull requests 1 to 41 exist (all merged or closed at the time).

## What the rewrite does (plain language)

`git filter-repo` replays every commit and leaves the one file out. Every commit gets a new id, so old clones and old links to commits stop matching. It cannot be undone on the remote after the force-push, which is why the backup comes first.

## Steps

1. **Settle open work.** Merge or close every open pull request and note every unmerged branch (`gh pr list --state open`; `git branch -r`). After the rewrite their commit ids no longer exist. Tell anyone else who has a clone or a local branch to stop pushing.
2. **Back up the whole repository.** The backup holds the personal data too, so keep it on your own encrypted disk only, never in a cloud folder or another repository:
   ```bash
   git clone --mirror https://github.com/bbotond83/waldorf-community-task-manager.git ~/backup-waldorf-before-rewrite.git
   ```
3. **Work in a fresh mirror clone** (filter-repo refuses to run in a clone that is not fresh):
   ```bash
   git clone --mirror https://github.com/bbotond83/waldorf-community-task-manager.git ~/waldorf-rewrite.git
   cd ~/waldorf-rewrite.git
   ```
4. **Install the tool** if needed: `brew install git-filter-repo`.
5. **Remove the file from every commit:**
   ```bash
   git filter-repo --path "source-materials/waldorf-community-app/Ovis tábla v2.xlsx" --invert-paths
   ```
   If the path with the accent does not match, also try the decomposed form of "á", or use `--path-glob "source-materials/waldorf-community-app/Ovis t*bla v2.xlsx"`.
6. **Verify before pushing** (all must show nothing):
   ```bash
   git log --all --oneline -- "source-materials/waldorf-community-app/Ovis tábla v2.xlsx"
   git rev-list --all --objects | grep -i "xlsx"
   ```
   Then check that the other history is intact: `git log --oneline | wc -l` should be about the same as in the backup, and the latest tree should match `main` before the rewrite (`git diff` between the backup's `main` and the rewritten `main` should be empty apart from the commit ids).
7. **Force-push** (filter-repo removes the `origin` remote on purpose, so add it back). GitHub's branch protection may block the push; if so, lift it temporarily and restore it afterwards:
   ```bash
   git remote add origin https://github.com/bbotond83/waldorf-community-task-manager.git
   git push --force --mirror origin
   ```
   `--mirror` also rewrites tags. It will report errors for `refs/pull/*` (GitHub's own read-only references); that is expected.
8. **Ask GitHub Support to purge** the old objects: open a support request ("Remove sensitive data from a repository"), give the repository name, the commit `035ded3`, the file path, and ask them to run garbage collection and to remove cached views and the `refs/pull/*` references that still point at the old commits. Until they do, the old objects can stay reachable by commit id and through the old pull requests.
9. **Re-clone everywhere.** On every machine and in every tool that holds a copy (including the worktrees under `.claude/worktrees/`): delete the old clone, clone again, and re-create `.env` files and any local branches you still need (cherry-pick from the backup, but only commits that do not contain the workbook). Never push from an old clone: it would bring the file back.
10. **Check the result.** In a fresh clone run `git log --all -- "source-materials/waldorf-community-app/Ovis tábla v2.xlsx"` (empty), and `npm run scan:privacy`.
11. **Tell the assistant** the rewrite is done. Then D1 (narrowing the content-scan exemption for `aidlc/` and `source-materials/`) can proceed, and the "real workbook is still in git history" statement in `verification/reports/u5-workbook-and-known-limits.md` gets a dated update.
12. **Dispose of the backup** once you are sure nothing needs it: it still contains the personal data.

## Risks

- Anyone who already cloned the repository, or who copied the workbook out, keeps it. A rewrite cannot reach those copies.
- Forgetting step 9 is the usual way the file comes back.
- The backup and the mirror clone hold the personal data until deleted.
