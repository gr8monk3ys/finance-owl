# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `needs-human`        | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

Every label in the right-hand column exists in this repo — checked against
`gh label list`. `needs-triage`, `needs-info` and `ready-for-agent` were
created for these roles; `wontfix` and `needs-human` already existed, which
is why the fourth row maps across to `needs-human` rather than introducing a
near-duplicate `ready-for-human`.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.
