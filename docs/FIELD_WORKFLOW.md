# Field verification workflow

```
AI DETECTED ──(officer reviews)──> UNDER_REVIEW ──(task assigned)──> FIELD_ASSIGNED
      │                                                                   │
      │                                    field officer submits GPS + observation + photo
      │                                                                   ▼
      │                                  reviewing officer ACCEPTS evidence ──> FIELD_VERIFIED ──(decision)──> CONFIRMED
      │                                  reviewing officer REJECTS evidence ──> REJECTED
      └── (never skips to VERIFIED/CONFIRMED: the API refuses without accepted evidence)
```
* Tasks carry the AI reason (the alert's triggering numbers), location, required evidence and assignee.
* Field officers see **My Tasks** only; they can start a task and submit evidence (device GPS supported).
* Every transition is audited with user, role, old/new status and reason.
* Alerts linked to a task are RESOLVED when its evidence is accepted.
* Reports include a "Field verification" section listing each task's evidence and verification outcome.
