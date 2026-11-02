<div align="center">
  <h1>Yiqi Workshop MDM</h1>
  <p><strong>Master-data governance, business foundations, and production engineering</strong></p>
  <p>Unified catalogs, data quality, materials, storage identities, BOMs, process routes, production resources, and accessory processing.</p>

  <p>
    <a href="https://gitee.com/art-si/art-supabase-mdm">Gitee</a>
    ·
    <a href="https://github.com/art-si/art-supabase-mdm">GitHub</a>
    ·
    <a href="https://gitee.com/art-si/art-supabase-pro">Platform</a>
    ·
    <a href="https://art-si.github.io/art-supabase-doc/modules/mdm">Documentation</a>
    ·
    <a href="./README.md">简体中文</a>
  </p>
</div>

## Purpose

MDM provides common identities and production foundations for Yiqi Workshop. It combines governed catalogs over authoritative Platform, HR, TMS, VMS, SMIS, and MDM records with the material, storage, partner, production, and engineering configuration owned by MDM.

This repository owns domain pages, APIs, types, and rules. [`art-supabase-pro`](https://gitee.com/art-si/art-supabase-pro) supplies authentication, tenancy, dynamic menus, action permissions, layout, themes, shared components, and the common Supabase runtime.

## Current Capabilities

| Area | Coverage |
| --- | --- |
| Catalog and governance | Five domains, 24 master types plus employee assignments and customer addresses; pagination, filters, completeness, provenance, and details |
| Quality and change | Quality scans and remediation, change requests and review/publication, manual duplicate-candidate review, golden-record mappings, delivery monitoring, and retries |
| Materials | Types, categories, attribute groups, units, code rules, archives, and category-based descriptions |
| Storage foundations | Warehouses, zones, bins and 3D views, lots, packages, serials, reservations, movement types, outbound rules, and supply-chain code rules |
| Commercial foundations | Customers, suppliers, projects, settlement methods, receipt/payment terms, and payment purposes |
| Production resources | Department/line trees, personnel, holidays, calendars, shift scheduling, work-center assignments, and operation templates |
| Engineering | Component types, BOM maintenance and structure, production equipment, electronic work instructions, operations, workstations, control codes, formulas, and routes |
| Accessory processing | Image/PDF/DOCX recognition, human correction, saved processing lists, and authorized material/BOM/MES order generation |
| Business configuration | Document/business types, menu applicability, defaults, extension fields, and packing parameters |

Recent work connects material coding and descriptions, BOM components, accessory lists, and MES work orders. Multi-menu document types validate applicable defaults and business-type scope. Forms, record selectors, details, async states, and deletion reference checks reuse platform components.

## Ownership and Integration

The unified catalog remains a read/governance surface. Source applications own employee, customer, vehicle, and other authoritative records. Governed changes produce controlled requests and delivery records; names and codes do not trigger automatic merges, and historical snapshots retain their original facts. MDM-owned foundations have explicit maintenance pages.

```text
Organization / personnel / materials / warehouses
  → BOMs, process routes, and calendars
  → work centers, resources, and execution rules
  → MES orders, scheduling, dispatch, and reporting
  → WMS material issue/return, finished receipt, and traceability
```

Activate materials and warehouses and align organization, project, and construction-section identities before cross-module operations. MES issue warehouses must allow picking and match the order type; bin-managed warehouses also require usable bins. MES owns production results; WMS owns inventory movements.

Recognition outputs are drafts for human review. Saving a list and generating master data or orders are separate authorized actions.

## Local Development

Requirements: Node.js `>= 22.13.0`, pnpm `>= 11.28.2`.

```powershell
pnpm install
pnpm dev
```

Default URL: `http://localhost:3017`. Develop under `modules/art-supabase-mdm` in the platform checkout or use the pinned platform dependency for a standalone clone. `ART_SUPABASE_PLATFORM_ROOT` can select a local platform checkout.

The shared Vite factory merges platform and application environment settings. Configure the backend and public path for your deployment and keep server credentials out of browser settings.

| Command               | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `pnpm boundary:audit` | Audit module ownership boundaries                        |
| `pnpm typecheck`      | Run the shared module typecheck                          |
| `pnpm check`          | Boundary/UI audits, types, ESLint, and module unit tests |
| `pnpm build`          | Typecheck and build static output in `docs/`             |
| `pnpm preview`        | Preview the build                                        |

`VITE_BASE_URL` controls the deployment base path. Business menus come from the server and align with `src/views/**/index.vue`.

## Collaboration and Security

Push module changes before updating the platform gitlink. Reuse platform utilities and components; cross-domain APIs must be purpose-specific, tenant-isolated, and limited to necessary fields.

Ordinary users remain in their authenticated tenant. Platform-super all/selected-tenant behavior follows the platform contract. Reads and mutations retain server permissions and RLS; deleting referenced records must not erase business history.

Enabled ordinary users can use read-only AI and create tenant-owned master data with the corresponding `Add` permission. Other AI mutations, configuration, publication, and controlled writes require platform-super authorization. Audit persistence does not grant business-write access.

## License

Licensed under [MulanPSL-2.0](LICENSE).
