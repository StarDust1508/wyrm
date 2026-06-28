/* ============================================================
   Galathilion — RichEditor (Tiptap / ProseMirror).
   Replaces the old execCommand editor. Same props as before so call sites
   stay unchanged: { initialHtml, onChange, placeholder, minHeight }.
   Adds: H2/H3, bold/italic/underline/strike, ordered+unordered lists,
   blockquote, links, scene-break (hr), undo/redo, live word/char count,
   markdown input rules (## , **b**, - list…), find/replace, .docx/.txt import.
   ============================================================ */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import { cleanHtml } from './lib/sanitize.js'

/* ---- toolbar button ---- */
function TBtn({ on, active, disabled, title, children, style }) {
  return (
    <button type="button" className={'tt-btn' + (active ? ' is-active' : '')}
      onMouseDown={e => { e.preventDefault() }} onClick={on} disabled={disabled}
      title={title} aria-label={title} aria-pressed={!!active} style={style}>
      {children}
    </button>
  )
}

export function RichEditor({ initialHtml, onChange, placeholder, minHeight = 320 }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState('')
  const [, bump] = useState(0)            // force re-render so active states track selection
  const [linkBar, setLinkBar] = useState(false)
  const [linkVal, setLinkVal] = useState('')
  const [findBar, setFindBar] = useState(false)
  const [findVal, setFindVal] = useState('')
  const [replVal, setReplVal] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,                  // prose-focused; inline code only
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener nofollow', target: '_blank' },
        },
      }),
      Placeholder.configure({ placeholder: placeholder || 'Пиши свою историю…' }),
      CharacterCount,
      Typography,
    ],
    content: initialHtml || '',
    autofocus: false,
    onUpdate: ({ editor }) => onChange && onChange(editor.getHTML()),
    editorProps: { attributes: { class: 'tt-content', spellcheck: 'true' } },
  })

  // re-render toolbar on every transaction so isActive()/can() stay in sync
  useEffect(() => {
    if (!editor) return
    const h = () => bump(n => n + 1)
    editor.on('transaction', h)
    editor.on('selectionUpdate', h)
    return () => { editor.off('transaction', h); editor.off('selectionUpdate', h) }
  }, [editor])

  // adopt external content changes (draft switch / import) without losing caret
  useEffect(() => {
    if (editor && initialHtml != null && initialHtml !== editor.getHTML()) {
      editor.commands.setContent(initialHtml || '', false)
    }
  }, [initialHtml, editor])

  const importFile = useCallback(async (file) => {
    if (!file || !editor) return
    setBusy('Импортирую «' + file.name + '»…')
    try {
      let html = ''
      if (/\.docx$/i.test(file.name)) {
        const mammoth = await import('mammoth/mammoth.browser.js')
        const ab = await file.arrayBuffer()
        const conv = mammoth.convertToHtml || (mammoth.default && mammoth.default.convertToHtml)
        const res = await conv({ arrayBuffer: ab })
        html = res.value || ''
      } else {
        const txt = await file.text()
        html = txt.split(/\n{2,}/).map(p =>
          '<p>' + p.replace(/[<>&]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[s])).replace(/\n/g, '<br>') + '</p>'
        ).join('')
      }
      editor.commands.setContent(cleanHtml(html), true)
      onChange && onChange(editor.getHTML())
      setBusy('')
    } catch (e) {
      setBusy('Не удалось прочитать файл: ' + (e && e.message ? e.message : e))
    }
  }, [editor, onChange])

  const applyLink = () => {
    if (!editor) return
    const url = linkVal.trim()
    if (!url) { editor.chain().focus().unsetLink().run() }
    else { editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run() }
    setLinkBar(false); setLinkVal('')
  }

  // find / replace over the document's text nodes
  const replaceAll = () => {
    if (!editor || !findVal) return
    const { state } = editor
    const re = new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    const tr = state.tr
    let count = 0
    // walk text nodes back-to-front so positions stay valid as we replace
    const repl = []
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        let m
        const text = node.text
        re.lastIndex = 0
        while ((m = re.exec(text)) !== null) {
          repl.push({ from: pos + m.index, to: pos + m.index + m[0].length })
        }
      }
    })
    for (let i = repl.length - 1; i >= 0; i--) {
      tr.insertText(replVal, repl[i].from, repl[i].to); count++
    }
    if (count) { editor.view.dispatch(tr); onChange && onChange(editor.getHTML()) }
    setBusy(count ? `Заменено: ${count}` : 'Ничего не найдено')
    setTimeout(() => setBusy(''), 1600)
  }

  if (!editor) return <div className="tt-editor" style={{ minHeight }} />

  const words = editor.storage.characterCount ? editor.storage.characterCount.words() : 0
  const chars = editor.storage.characterCount ? editor.storage.characterCount.characters() : 0
  const A = (name, attrs) => editor.isActive(name, attrs)

  return (
    <div className="tt-editor">
      <div className="tt-toolbar" role="toolbar" aria-label="Форматирование">
        <div className="tt-group">
          <TBtn on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={A('heading', { level: 2 })} title="Заголовок" style={{ fontWeight: 800 }}>H2</TBtn>
          <TBtn on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={A('heading', { level: 3 })} title="Подзаголовок" style={{ fontWeight: 700 }}>H3</TBtn>
        </div>
        <div className="tt-group">
          <TBtn on={() => editor.chain().focus().toggleBold().run()} active={A('bold')} title="Жирный (Ctrl/Cmd+B)" style={{ fontWeight: 800 }}>Ж</TBtn>
          <TBtn on={() => editor.chain().focus().toggleItalic().run()} active={A('italic')} title="Курсив (Ctrl/Cmd+I)" style={{ fontStyle: 'italic', fontFamily: 'var(--serif)' }}>К</TBtn>
          <TBtn on={() => editor.chain().focus().toggleUnderline().run()} active={A('underline')} title="Подчёркнутый (Ctrl/Cmd+U)" style={{ textDecoration: 'underline' }}>П</TBtn>
          <TBtn on={() => editor.chain().focus().toggleStrike().run()} active={A('strike')} title="Зачёркнутый" style={{ textDecoration: 'line-through' }}>З</TBtn>
        </div>
        <div className="tt-group">
          <TBtn on={() => editor.chain().focus().toggleBulletList().run()} active={A('bulletList')} title="Список">•—</TBtn>
          <TBtn on={() => editor.chain().focus().toggleOrderedList().run()} active={A('orderedList')} title="Нумерованный список">1.</TBtn>
          <TBtn on={() => editor.chain().focus().toggleBlockquote().run()} active={A('blockquote')} title="Цитата">❝</TBtn>
        </div>
        <div className="tt-group">
          <TBtn on={() => { setLinkBar(v => !v); setLinkVal(editor.getAttributes('link').href || '') }} active={A('link')} title="Ссылка">🔗</TBtn>
          <TBtn on={() => editor.chain().focus().setHorizontalRule().run()} title="Разрыв сцены">— ✦ —</TBtn>
        </div>
        <div className="tt-group">
          <TBtn on={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Отменить (Ctrl/Cmd+Z)">↶</TBtn>
          <TBtn on={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Повторить">↷</TBtn>
        </div>
        <div className="tt-group">
          <TBtn on={() => setFindBar(v => !v)} active={findBar} title="Найти и заменить">⌕</TBtn>
          <TBtn on={() => fileRef.current && fileRef.current.click()} title="Импорт .docx / .txt">⇪</TBtn>
        </div>
        <span className="tt-count mono">{words} сл · {chars} зн</span>
        <input ref={fileRef} type="file" accept=".docx,.txt,.md" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; importFile(f) }} />
      </div>

      {linkBar && (
        <div className="tt-subbar">
          <input className="tt-input" value={linkVal} onChange={e => setLinkVal(e.target.value)}
            placeholder="https://… (пусто — убрать ссылку)" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } if (e.key === 'Escape') setLinkBar(false) }} />
          <button type="button" className="tt-mini" onMouseDown={e => e.preventDefault()} onClick={applyLink}>OK</button>
        </div>
      )}
      {findBar && (
        <div className="tt-subbar">
          <input className="tt-input" value={findVal} onChange={e => setFindVal(e.target.value)} placeholder="найти…" />
          <input className="tt-input" value={replVal} onChange={e => setReplVal(e.target.value)} placeholder="заменить на…"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); replaceAll() } }} />
          <button type="button" className="tt-mini" onMouseDown={e => e.preventDefault()} onClick={replaceAll}>Заменить все</button>
        </div>
      )}

      <EditorContent editor={editor} className="tt-scroll" style={{ '--tt-min': minHeight + 'px' }} />
      {busy && <div className="tt-busy mono">{busy}</div>}
    </div>
  )
}

export default RichEditor
