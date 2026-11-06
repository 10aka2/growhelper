# Branch Lifecycle

How this repo handles feature branches around pull requests.

## Merge style

Pull requests are **squash-merged** into `master`. This keeps `master` linear and
carries the conventional-commit message (`feat: …`, `fix: …`) as a single commit.

## After the merge: delete the branch

Once a PR is merged, its head branch is **no longer needed** — the squash commit on
`master` contains the identical tree. Delete the branch **locally and on the
remote**:

```bash
# Confirm the PR is really merged first
gh pr view <number> --json state   # must be MERGED

# Local: -D is required, because a squash merge makes the branch tip a
# non-ancestor of master, so plain -d refuses to delete it.
git branch -D <branch>

# Remote
git push origin --delete <branch>

# Drop the stale remote-tracking refs
git fetch origin --prune
```

The merged PR stays visible on GitHub (state `merged`, linked to the squash
commit), and the branch's individual commits remain reachable through the PR —
deleting the branch does not lose the work.

## Why not keep the branch

A squash-merged branch has no unique content left: `git diff master <branch>`
shows only later master commits, nothing from the branch itself. Keeping it would
only clutter `git branch -a` and invite accidental pushes to a dead branch.
