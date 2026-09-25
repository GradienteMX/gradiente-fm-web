/**
 * CALCOS in the DOM: a sticker (Calco) in its finish, your binder (Carpeta),
 * a franja's shelf (Estante, one card per design with its finishes), a
 * finish swatch (Muestra) and a night's stub (StickerEvento). The art itself
 * is lib/stickers/arte, the finish lib/stickers/acabado; the data is
 * lib/stickers + lib/store/world-core.
 */

export { Calco, type CalcoProps } from './Calco'
export { Carpeta, comoLlego } from './Carpeta'
export { Estante } from './Estante'
export { Muestra } from './Muestra'
export { StickerEvento, CLAIM_WINDOW_DAYS } from './StickerEvento'
export {
  acabado,
  COPIA_UNICA,
  edad,
  esUnica,
  fechaCorta,
  FORM_LABEL,
  formaMaterial,
  HOLO_NOTE,
  lineaCopia,
  MATERIAL_LABEL,
  MATERIAL_NOTE,
  METAL_NOTE,
  nombreCorto,
  notaAcabado,
  precio,
  RELIEVE_NOTE,
  serialLabel,
  SOURCE_LABEL,
  VIA_LABEL,
} from './labels'
