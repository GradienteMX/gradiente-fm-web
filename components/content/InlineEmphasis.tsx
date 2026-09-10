import { Fragment, type ReactNode } from 'react'

// The editor and public readers share the same supported emphasis syntax.
export function InlineEmphasis({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const pattern = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let end = 0
  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(end, match.index))
    parts.push(match[1] ? <strong key={match.index}><em>{match[1]}</em></strong> : match[2] ? <strong key={match.index}>{match[2]}</strong> : <em key={match.index}>{match[3]}</em>)
    end = match.index! + match[0].length
  }
  parts.push(text.slice(end))
  return <>{parts.map((part, i) => <Fragment key={i}>{part}</Fragment>)}</>
}

// A passive preview never starts playback or navigates away from the editor.
export function InlineTextPreview({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const pattern = /\[([^\]]+)\]\((https?:[^)]+)\)/g
  let end = 0
  for (const match of text.matchAll(pattern)) {
    parts.push(<InlineEmphasis key={`${match.index}-text`} text={text.slice(end, match.index)} />)
    parts.push(<span key={match.index} className="underline decoration-dotted underline-offset-4"><InlineEmphasis text={match[1]} /></span>)
    end = match.index! + match[0].length
  }
  parts.push(<InlineEmphasis key="end" text={text.slice(end)} />)
  return <>{parts}</>
}
