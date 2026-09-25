import type { ContentItem, PollAttachment } from '@/lib/types'
import { resolvePollChoices, type ResolvedChoice } from '@/lib/store/world-core'
import type { PollTally } from '@/lib/store/snapshot'

export const POLL_DEFAULT_PROMPT: Record<PollAttachment['kind'], string> = {
  'from-list': '¿Tu favorito?',
  'from-tracklist': '¿Mejor track del set?',
  attendance: '¿Vas?',
  freeform: '',
}

export function isPollClosed(poll: PollAttachment, now: Date): boolean {
  return Boolean(poll.closesAt && new Date(poll.closesAt).getTime() < now.getTime())
}

export interface PollResults {
  choices: Array<ResolvedChoice & { votes: number; share: number }>
  total: number
}

/**
 * A poll's result from its tally (the server's count of voters and picks,
 * moved by the viewer's own vote). `total` is distinct voters, so a
 * multi-choice poll's shares can add up past 100 %, as they should.
 */
export function aggregate(item: ContentItem, tally: PollTally | undefined): PollResults {
  const choices = resolvePollChoices(item)
  const total = tally?.voters ?? 0
  return {
    total,
    choices: choices.map((c) => {
      const v = tally?.counts[c.id] ?? 0
      return { ...c, votes: v, share: total ? v / total : 0 }
    }),
  }
}
