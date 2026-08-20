# Listicles · seeds para Supabase

Un archivo `.sql` por artículo. Cada uno es un `insert into items ... on conflict (id) do update`,
o sea que se puede volver a correr sin duplicar nada: la segunda corrida actualiza la fila.

## Cómo subirlos

1. **Portada primero.** Sube el `.gif` al bucket `uploads` de Storage (es público).
2. **Copia la URL pública.** Queda así:
   `https://<PROJECT_REF>.supabase.co/storage/v1/object/public/uploads/<Nombre>.gif`
3. **Reemplaza el placeholder** en el `.sql`. Busca la línea que dice
   `https://REEMPLAZAR.supabase.co/...PORTADA.gif` y pon la URL real.
4. **Pega el archivo completo** en el SQL Editor de Supabase y corre.

## Verificar que quedó

```sql
select id, slug, type, title, author, published, image_url
from items where type = 'listicle' order by published_at desc;
```

Si `image_url` sigue diciendo `REEMPLAZAR`, la portada no se cambió.

## Cómo escribir uno nuevo

**Léete [`GUIA-VOZ-EDITORIAL.md`](GUIA-VOZ-EDITORIAL.md) antes de escribir.** Ahí está
la voz, lo que nunca se puede hacer (guiones largos, "no es X es Y", adjetivos de hype),
el repertorio de movimientos que se rotan para que no todos suenen igual, y las reglas
de verificación de datos.

## Notas de formato

- `type = 'listicle'` lo renderiza `components/overlay/ListicleOverlay.tsx`.
- El cuerpo va en `article_body` (jsonb). Bloques usados: `lede`, `p`, `divider`, `track`.
- El bloque `track` acepta `rank`, `artist`, `title`, `year`, `bpm`, `imageUrl`, `embeds[]`, `commentary`.
  Las llaves van en camelCase porque el jsonb se guarda tal cual y se lee directo en TypeScript.
- `embeds[].platform` solo acepta: `soundcloud`, `youtube`, `spotify`, `bandcamp`, `mixcloud`.
- Los ranks van **ascendentes desde 01**. Nunca hay 00 ni cuenta regresiva.
- El "pilón" es solo una palabra en el texto. Lleva su número normal como cualquier otra entrada.
- Cada entrada lleva su link de YouTube, obligatorio. Puede ser el full album, la canción suelta o una playlist.
- `author` es texto libre. Los autores son firmas editoriales, no cuentas de usuario.
- `seed = false` y `published = true` para que entren al feed principal.

## Índice

| # | Archivo | Título | Autor | Portada |
|---|---|---|---|---|
| 01 | `01-touch-cinco-discos.sql` | 6 discos clásicos de Touch (y un pilón) | `lalo_timestretch` | `touch.gif` |
| 02 | `02-nivel-acuatico.sql` | 7 rolas bien acuáticas | `Nena Tempest` | pendiente |
