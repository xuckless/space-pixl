import type { ReactNode } from 'react'

/**
 * Just enough Markdown for the legal documents in /legal: a front matter
 * block, `##`/`###` headings, paragraphs, `-` and `1.` lists, `---` rules,
 * and inline **bold**, `code` and [links](url). Links open in the browser
 * (the main process routes every new window to the system).
 */

export interface Doc {
  meta: Record<string, string>
  body: ReactNode[]
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

function inline(text: string, key: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part, i) => {
      const k = `${key}.${i}`
      if (part.startsWith('**')) return <strong key={k}>{part.slice(2, -2)}</strong>
      if (part.startsWith('`')) return <code key={k}>{part.slice(1, -1)}</code>
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
      if (link)
        return (
          <a key={k} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        )
      return part
    })
}

export function parseMarkdown(source: string): Doc {
  const meta: Record<string, string> = {}
  let text = source.replace(/\r\n/g, '\n')
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = /^(\w+):\s*(.*)$/.exec(line)
      if (m) meta[m[1]] = m[2]
    }
    text = text.slice(fm[0].length)
  }

  const body: ReactNode[] = []
  const blocks = text.trim().split(/\n{2,}/)
  blocks.forEach((block, b) => {
    const key = `b${b}`
    const lines = block.split('\n')
    const head = /^(#{1,3})\s+(.*)$/.exec(lines[0])
    if (head && lines.length === 1) {
      const level = head[1].length
      const content = inline(head[2], key)
      body.push(
        level === 1 ? (
          <h1 key={key}>{content}</h1>
        ) : level === 2 ? (
          <h2 key={key}>{content}</h2>
        ) : (
          <h3 key={key}>{content}</h3>
        )
      )
    } else if (/^-{3,}$/.test(block.trim())) {
      body.push(<hr key={key} />)
    } else if (lines.every((l) => /^(-|\d+\.)\s+/.test(l) || /^\s+\S/.test(l))) {
      // A list; indented lines continue the item above them.
      const items: string[] = []
      for (const l of lines) {
        if (/^(-|\d+\.)\s+/.test(l)) items.push(l.replace(/^(-|\d+\.)\s+/, ''))
        else items[items.length - 1] += ' ' + l.trim()
      }
      const lis = items.map((item, i) => <li key={i}>{inline(item, `${key}.${i}`)}</li>)
      body.push(/^\d+\./.test(lines[0]) ? <ol key={key}>{lis}</ol> : <ul key={key}>{lis}</ul>)
    } else {
      body.push(<p key={key}>{inline(lines.join(' '), key)}</p>)
    }
  })
  return { meta, body }
}
