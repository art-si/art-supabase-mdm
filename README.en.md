<div align="center">
  <h1>Yiqi Workshop MDM</h1>
  <p><strong>Enterprise master-data governance and production-foundation management for Yiqi Workshop</strong></p>
  <p>Unified catalogs, source traceability, data-quality review, production organizations, factory calendars, work centers, standard operations, and process routes.</p>

  <p>
    <a href="https://gitee.com/wangyanghub/art-supabase-mdm">Gitee</a>
    ·
    <a href="https://github.com/869123771/art-supabase-mdm">GitHub</a>
    ·
    <a href="https://gitee.com/wangyanghub/art-supabase-pro">Platform</a>
    ·
    <a href="https://869123771.github.io/art-supabase-doc/modules/mdm">Documentation</a>
    ·
    <a href="./README.md">简体中文</a>
  </p>
</div>

## Positioning

Yiqi Workshop MDM is the master-data governance and production-foundation application for Yiqi Workshop. It provides a unified read-only catalog over authoritative records owned by Platform, HR, TMS, VMS, and SMIS, while owning production-specific configuration such as departments, personnel settings, factory calendars, standard operations, work centers, and process routes.

Authentication, tenancy, navigation, authorization, layout, shared components, stores, and the common Supabase client remain owned by [`art-supabase-pro`](https://gitee.com/wangyanghub/art-supabase-pro).

## Current Capabilities

| Area | Coverage |
| --- | --- |
| Governance overview | Five governance domains, record/source totals, and data-attention metrics |
| Unified catalog | 26 source record types, server pagination, combined filters, lifecycle, completeness, provenance, and details |
| Production organization | Department/line trees, production-person configuration, secure employee selection, import/export, and permission boundaries |
| Factory calendar | Shifts, breaks, overnight schedules, rotation patterns, batch scheduling, reference patterns, and coverage reminders |
| Standard operations | Templates, task checklists, scoring, copying, and work-center/process bindings |
| Resources and routing | Work centers, personnel and device assignments, execution policies, defaults, QR codes, and process routes |

## Ownership Boundary

The unified catalog is not a second write channel. Existing organization, employee, customer, carrier, vehicle, equipment, and material records remain writable only through their owning applications. MDM exposes governed, tenant-scoped read models and quality signals without automatically merging records by name or code.

Production extensions are owned by MDM and provide stable semantics for future MES execution. Production orders, dispatching, machine collection, reporting, inspection, and completion records belong to MES and are not fabricated in this repository.

## Run Locally

Requirements: Node.js `>= 22.0.0` and pnpm `>= 11.9.0`.

```powershell
pnpm install
pnpm dev
```

The default development URL is `http://localhost:3017`.

```powershell
pnpm check
pnpm build
pnpm preview
```

Production output is written to `docs/` with `/art-supabase-mdm/` as the default public base path.

## Platform Collaboration and Security

Commit and push MDM changes in this repository, then update the `modules/art-supabase-mdm` gitlink in the platform repository. Cross-domain reads must use purpose-specific, tenant-isolated, minimum-field API/RPC contracts. UI visibility never replaces RLS, RPC authorization, server-side mutation checks, or reference-integrity constraints.

## License

Licensed under [MulanPSL-2.0](LICENSE).
