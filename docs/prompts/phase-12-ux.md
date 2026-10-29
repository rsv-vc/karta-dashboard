# Phase 12 prompt: home, leads access, notifications, masters, investor view

```text
Karta Lead Tracker, Phases 1–11 done (sales MIS model, calculator, real data live). Rework the experience.

## 1. Home: key metrics and action points
- "Today": overdue next steps, due today, open accounts with no next step, stale accounts (no contact 14+ days),
  accounts missing calculator data; each with the accounts listed and one-click actions.
- Key numbers with month-on-month deltas: open deal value and minutes, discoveries this month, POCs live, won
  this month, Hot + Warm, average score. Targets progress (own for agents, team for employees).
- Recent wins and new accounts. The analytical tables move to the Investor section.

## 2. My leads and All leads
- Two entries for everyone: My leads (accounts you own, full detail) and All leads.
- All leads: employees see every account in full; sales agents see company, contact and owner only (no stage),
  in the list, search and duplicate warnings. The database enforces it.

## 3. Notifications
- Bell in the header with an unread count and a panel: overdue and due-today next steps, accounts reassigned to
  you, new accounts, client closures (wins, celebrated), monthly target met. Computed from the data; "seen"
  is stored per person (mark all read).

## 4. Masters (employees)
- Team members and Sales agents (the existing member management, split).
- Industries: name, average calls a month, minutes a call → average minutes a month; drives the calculator.
- Cities, Pricing (default ₹/min, the low–high range, default minutes a call, default contract months).
- Stages: rename and change score points (order and movement rules stay fixed).
- Drop-off reasons (for Lost, Deferred or both). Required when an account is marked Lost or Deferred.
- Changing an industry average or the pricing defaults recalculates accounts that use those defaults.

## 5. Investor section (employees)
- Pipeline & revenue: open deal value and minutes, won value, by segment and source, month-on-month.
- Funnel root causes: conversion and drop-off at every step, with the drop-off reasons where accounts were lost
  or deferred, dead-lead reasons, time spent per stage; the Funnel Health problems and fixes.
- Cohort trends: each discovery month's progress (follow-up+, technical+, POC+, won) to show whether
  conversion is improving.

## Decisions (confirmed by the user)
- Investor section: pipeline & revenue and cohort trends, plus the funnel root-cause and drop-off analysis.
- A drop-off reason from the master list is required for Lost and Deferred.
- Stages master: rename and change points only.
```
