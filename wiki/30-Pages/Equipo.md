# Equipo

> `/equipo` — collaborator list with GitHub handles, roles, and bio placeholders.

## What it is

Static page rendered with [[BrandPageShell]]. Lists the three collaborators defined in `CLAUDE.md`:

| Handle | Role |
|--------|------|
| `datavismo-cmyk` | Project lead · curaduría · dirección editorial |
| `hzamorate` | Colaborador |
| `ikerio` | Colaborador |

Each entry links to `github.com/<handle>`. Bios are `<Redactar>` placeholders until each person writes their own. Roles listed are provisional — the team will revise them.

## Structure

```
EquipoPage (server)
  └── BrandPageShell (subsystem="EQUIPO")
        └── <ul> of collaborator cards, one per COLLABORATORS entry
```

## Related

- [[BrandPageShell]] — shared chrome for `/about`, `/manifesto`, `/equipo`
- [[About]] — companion identity page
