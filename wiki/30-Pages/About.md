# About

> `/about` — identity surface explaining what Gradiente FM is.

## What it is

Static editorial page rendered with [[BrandPageShell]]. Covers:

1. What Gradiente FM is (editorial + agenda + mixes from inside the scene)
2. The vibe filter — 0 glacial → 10 volcán, subjective + editorial
3. What content types live on the platform
4. Connection to [[FASCINOMA]] and Club Japan

Several sections contain `<Redactar>` placeholder markers where the editorial team still needs to write copy (contact info, deeper partner context).

## Structure

```
AboutPage (server)
  └── BrandPageShell (subsystem="ABOUT")
        ├── Lead paragraph + FASCINOMA link
        ├── BrandSection 1 — EL FILTRO DE VIBE
        ├── BrandSection 2 — QUÉ ENCONTRÁS ACÁ
        └── BrandSection 3 — CONEXIONES
```

## Related

- [[BrandPageShell]] — shared chrome for `/about`, `/manifesto`, `/equipo`
- [[Manifesto]] — editorial declaration
- [[Equipo]] — collaborator list
- [[FASCINOMA]] — connected project
