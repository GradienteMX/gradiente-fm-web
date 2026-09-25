/**
 * Every backend call a world action makes, registered on import (world.tsx
 * imports this module once). One file per domain; see ../effects.ts, and
 * http.ts (requests, ordering, uploads) + mapping.ts (the pure contracts).
 *
 *   piezas       touch · save · reading · vote · harvest · pin · hp-adjust · item-delete
 *   comentarios  comment · comment-edit · comment-tombstone · comment-restore · react · save-comment
 *   foro         thread · reply · foro-tombstone
 *   mesa         draft-save · draft-delete · publish
 *   personas     profile · user-admin · follow · seen (this device only)
 *   moderacion   report · report-resolve
 *   acceso       invite · waitlist-status · waitlist-delete
 *   franjas      franja-patch · listing-upsert · listing-delete · listing-comment · listing-comment-delete
 *   stickers     sticker-get · sticker-apply · sticker-scrape
 */

import './piezas'
import './comentarios'
import './foro'
import './mesa'
import './personas'
import './moderacion'
import './acceso'
import './franjas'
import './stickers'
