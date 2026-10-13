# Shared Renovate config

Shared Renovate presets and workflows for Big Mouth Billy Bass repositories. This holds the must-haves every repo
should get, plus the auto-merge approval flow. Anything specific to one repo stays in that repo's `renovate-config.js`.

Every repo references this at `main`, so a change to these presets or the Renovate workflows reaches all of them on their next Renovate run.

## Presets

| Preset                | Use for                                        |
| --------------------- | ---------------------------------------------- |
| `default.json5`       | Any repo. The base the other presets extend.   |
| `github-action.json5` | JavaScript GitHub Actions that ship a `dist/`. |
| `dotnet.json5`        | .NET repos.                                    |

Extend exactly one. Where a rule belongs:

- Every repo needs it: `default.json5`.
- Every repo of one type needs it: that ecosystem preset.
- Otherwise: the repo's own `renovate-config.js`.

## Using it in a repo

`renovate-config.js`:

```js
module.exports = {
  extends: ['github>OctopusDeploy/team-bmbb-renovate-config:dotnet.json5'],
  // Repo-specific rules go here.
};
```

`.github/workflows/renovate.yml`:

```yaml
name: Renovate
on:
  schedule:
    - cron: "0 3 * * *"
      timezone: Australia/Brisbane
  workflow_dispatch:
jobs:
  renovate:
    uses: OctopusDeploy/team-bmbb-renovate-config/.github/workflows/renovate.yml@main
    secrets:
      RENOVATE_GITHUB_TOKEN: ${{ secrets.RENOVATE_GITHUB_TOKEN }}
```

`.github/workflows/renovate-approve.yml`:

```yaml
name: Renovate approve
on:
  pull_request:
    types: [labeled, synchronize]
jobs:
  renovate-approve:
    uses: OctopusDeploy/team-bmbb-renovate-config/.github/workflows/renovate-approve.yml@main
    permissions:
      pull-requests: write
```

`github-action.json5` runs a post-upgrade build, so repos using it must also allow that command in their own
`renovate-config.js` (`allowedCommands` and `allowShellExecutorForPostUpgradeCommands` can't be set from a preset).

### Repo settings

Check these when moving a repo over. Most of them fail quietly if they're missing.

- **Settings → Actions → General:** "Allow GitHub Actions to create and approve pull requests". This is already on
  for the organisation and all our repos. Check it's still on when moving a repo over, because without it
  `renovate-approve` can't approve.
- **Settings → General:** "Allow auto-merge". This is already on in all our repos. Check it's still on when moving a
  repo over, because `platformAutomerge` needs it.
- **`RENOVATE_GITHUB_TOKEN`:** the secret must be set, and the token needs read access to this repo so Renovate can
  fetch the presets.
- **`RENOVATE_AUTOMERGE_PAUSED`:** the organisation variable must be visible to the repo. If it isn't, pausing
  silently does nothing there.

This repo is internal, so its own Settings → Actions → General → Access must allow repos in the organisation.
Otherwise `uses: …@main` won't resolve.

## How auto-merge works

Auto-merge is opt-in per package. Renovate turns on GitHub's auto-merge and GitHub does the merge; `renovate-approve`
only supplies the approval Renovate can't give itself, and withdraws it if anyone else pushes.

1. A package rule sets `automerge: true` and `addLabels: ['automerge']`.
2. Renovate opens the PR with the `automerge` label and an "Automerge: Enabled" note in the body, and turns on
   GitHub's auto-merge (`platformAutomerge`).
3. The label triggers `renovate-approve`. It approves the PR only if all of these hold:
   - Renovate's account opened or pushed it, and the branch starts with `renovate/`.
   - It has the `automerge` label.
   - The body says "Automerge: Enabled". Labels are combined across a group, but Renovate only enables
     auto-merge when every package in the group allows it, so this check catches mixed groups.
   - `RENOVATE_AUTOMERGE_PAUSED` isn't set.
4. Main requires branches to be up to date, and GitHub's auto-merge won't update a branch itself. Renovate's default
   `rebaseWhen: 'auto'` rebases automerge PRs that are behind on each nightly run (other PRs only when they conflict),
   and the push triggers `renovate-approve` to approve again. If several are behind, one merges and the rest wait for
   the next night.
5. Once the PR is approved and its required checks pass, GitHub squash-merges it.

A PR Renovate hasn't opted in to never gets the label or the approval, so it waits for a human.

If anyone other than Renovate pushes to a `renovate/` branch (including clicking "Update branch"), `renovate-approve`
dismisses the bot's approval as soon as the push lands, normally well before the new commit's checks pass. The PR
then needs a human review like any other. Renovate stops updating a branch once someone else has pushed to it, so it isn't approved again. If
you tick the rebase checkbox, Renovate replaces the branch with its own commits, discarding the pushed changes, and
the PR is approved again.

## Adding an auto-merge rule

- Only auto-merge what can't reach shipped code: test tooling, dev dependencies, CI actions. A green build should be
  all the confidence you need.
- Always pair `automerge: true` with `addLabels: ['automerge']`. The approve workflow needs both the label and
  Renovate's "Automerge: Enabled" note in the PR body.
- Watch out for grouping. `config:recommended` groups monorepo packages, and labels are combined across a group. Don't
  list a package that ships alongside production packages (e.g. `Microsoft.AspNetCore.Mvc.Testing`).
- Pin and digest updates skip `minimumReleaseAge`, so keep them on manual review.

## Pausing auto-merge

During a supply-chain incident:

1. Set the organisation variable `RENOVATE_AUTOMERGE_PAUSED` to `true`. This stops new approvals.
2. Turn off GitHub's auto-merge on open auto-merge PRs. Otherwise PRs that are already approved merge as soon as their
   checks pass:

   ```bash
   gh search prs --owner OctopusDeploy --author team-github-bot --label automerge --state open --limit 100 \
     --json url --jq '.[].url' | xargs -n1 gh pr merge --disable-auto
   ```

3. Set `automerge: false` in `default.json5`, so Renovate stops turning auto-merge on.
4. Once it's clear, undo steps 1 and 3. Step 2 isn't undone automatically: run the same search with
   `gh pr merge --auto --squash` to turn auto-merge back on for the open PRs.

## Making changes

- `validate-renovate-config.yml` runs `renovate-config-validator --strict` and `actionlint` on every PR that touches
  this config or the reusable workflows.
- The Renovate version is pinned in `renovate.yml` and `validate-renovate-config.yml`. Renovate raises one PR to
  update both.
- This repo runs Renovate on itself (config in the root `renovate-config.js`) to keep its pinned actions current. Nothing here auto-merges.
