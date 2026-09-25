/**
 * Stickers → app/api/stickers/* (migration 0052). Copies keep the uid the
 * client minted (a UUID), so a sticker just received can be pressed before
 * any snapshot refresh.
 */

import { postJson, registerEffect } from '../effects'

registerEffect('sticker-get', async (a) => {
  if (a.via === 'boleto') {
    await postJson('/api/stickers/stub', { eventId: a.stickerId.replace(/^st-ev-/, ''), uid: a.uid }, 'No se pudo reclamar el talón.')
  } else {
    await postJson('/api/stickers/redeem', { stickerId: a.stickerId, uid: a.uid }, 'No se pudo canjear el vale.')
  }
})

registerEffect('sticker-apply', async (a) => {
  await postJson('/api/stickers/apply', { uid: a.uid, face: a.face, x: a.x, y: a.y, rot: a.rot, scale: a.scale }, 'No se pudo pegar el calco.')
})

registerEffect('sticker-scrape', async (a) => {
  await postJson('/api/stickers/scrape', { uid: a.uid }, 'No se pudo raspar el calco.')
})
