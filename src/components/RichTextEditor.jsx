import { useRef, useEffect, useCallback, useState } from 'react';
import styles from './RichTextEditor.module.css';

// Formatting toolbar button definitions
const INLINE_BTNS = [
  { cmd: 'bold',          icon: 'B',   title: 'Bold (Ctrl+B)',      style: { fontWeight: 800 } },
  { cmd: 'italic',        icon: 'I',   title: 'Italic (Ctrl+I)',    style: { fontStyle: 'italic' } },
  { cmd: 'underline',     icon: 'U',   title: 'Underline (Ctrl+U)', style: { textDecoration: 'underline' } },
  { cmd: 'strikeThrough', icon: 'S',   title: 'Strikethrough',      style: { textDecoration: 'line-through' } },
];

const BLOCK_BTNS = [
  { cmd: 'formatBlock', value: 'h1', icon: 'H1', title: 'Heading 1' },
  { cmd: 'formatBlock', value: 'h2', icon: 'H2', title: 'Heading 2' },
  { cmd: 'formatBlock', value: 'h3', icon: 'H3', title: 'Heading 3' },
  { cmd: 'formatBlock', value: 'p',  icon: '¶',  title: 'Paragraph' },
];

const LIST_BTNS = [
  { cmd: 'insertUnorderedList', icon: '≡', title: 'Bullet List' },
  { cmd: 'insertOrderedList',   icon: '①', title: 'Numbered List' },
];

export default function RichTextEditor({ value, onChange, isDark, onWordCount }) {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);
  const lastHtml = useRef(value || '');
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const savedRangeRef = useRef(null);

  // Sync value into DOM when parent updates it (remote change or initial load).
  // Setting innerHTML programmatically does NOT fire oninput, so there's no loop risk.
  // We skip the update if the DOM already has this exact content to avoid cursor jumps
  // when the user is actively typing locally.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // If the user is currently typing (isInternalChange tracks this), skip.
    // Otherwise always apply — this ensures remote changes always render.
    if (!isInternalChange.current && el.innerHTML !== (value || '')) {
      isInternalChange.current = true;
      el.innerHTML = value || '';
      lastHtml.current = value || '';
      isInternalChange.current = false;
    }
  }, [value]);

  // Report word count
  useEffect(() => {
    if (onWordCount) {
      const text = editorRef.current?.innerText || '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      onWordCount(words);
    }
  });

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el || isInternalChange.current) return;
    const html = el.innerHTML;
    lastHtml.current = html;
    onChange?.(html);
  }, [onChange]);

  const exec = useCallback((cmd, value) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value ?? null);
    handleInput();
  }, [handleInput]);

  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreRange = useCallback(() => {
    if (!savedRangeRef.current) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
  }, []);

  const insertChecklist = useCallback(() => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const range = sel?.getRangeAt(0);
    if (!range) return;

    const li = document.createElement('li');
    li.className = 'rt-task';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'rt-checkbox';
    cb.setAttribute('contenteditable', 'false');
    cb.addEventListener('change', handleInput);
    const span = document.createElement('span');
    span.setAttribute('contenteditable', 'true');
    span.innerHTML = '\u200B'; // zero-width space so cursor lands inside
    li.appendChild(cb);
    li.appendChild(span);

    // Wrap in ul.rt-checklist if needed
    let ul = document.createElement('ul');
    ul.className = 'rt-checklist';
    ul.appendChild(li);

    range.deleteContents();
    range.insertNode(ul);
    // Move cursor into span
    const newRange = document.createRange();
    newRange.setStart(span, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    handleInput();
  }, [handleInput]);

  const insertTable = useCallback(() => {
    restoreRange();
    editorRef.current?.focus();
    let html = '<table class="rt-table"><tbody>';
    for (let r = 0; r < tableRows; r++) {
      html += '<tr>';
      for (let c = 0; c < tableCols; c++) {
        html += r === 0
          ? `<th contenteditable="true"><br></th>`
          : `<td contenteditable="true"><br></td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    handleInput();
    setShowTablePicker(false);
  }, [tableRows, tableCols, handleInput, restoreRange]);

  const handleKeyDown = useCallback((e) => {
    // Tab key inside table cell — move to next cell
    if (e.key === 'Tab') {
      const sel = window.getSelection();
      const cell = sel?.anchorNode?.parentElement?.closest('td, th');
      if (cell) {
        e.preventDefault();
        const cells = Array.from(editorRef.current.querySelectorAll('td, th'));
        const idx = cells.indexOf(cell);
        const next = e.shiftKey ? cells[idx - 1] : cells[idx + 1];
        if (next) {
          const range = document.createRange();
          range.selectNodeContents(next);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        return;
      }
    }
    // Enter in checklist item — add new item
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      const li = sel?.anchorNode?.parentElement?.closest('li.rt-task');
      if (li) {
        e.preventDefault();
        const newLi = li.cloneNode(true);
        const newCb = newLi.querySelector('input[type="checkbox"]');
        if (newCb) { newCb.checked = false; newCb.addEventListener('change', handleInput); }
        const newSpan = newLi.querySelector('span');
        if (newSpan) newSpan.innerHTML = '\u200B';
        li.parentNode.insertBefore(newLi, li.nextSibling);
        // Move cursor
        if (newSpan) {
          const range = document.createRange();
          range.setStart(newSpan, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        handleInput();
        return;
      }
    }
  }, [handleInput]);

  const handlePaste = useCallback((e) => {
    // Paste as plain text to avoid external style pollution
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  return (
    <div className={`${styles.richEditor} ${isDark ? '' : styles.light}`}>
      {/* Formatting toolbar */}
      <div className={styles.formatBar}>
        {INLINE_BTNS.map(b => (
          <button
            key={b.cmd}
            className={styles.fmtBtn}
            title={b.title}
            onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
            style={b.style}
          >{b.icon}</button>
        ))}
        <div className={styles.fmtSep} />
        {BLOCK_BTNS.map(b => (
          <button
            key={b.cmd + b.value}
            className={styles.fmtBtn}
            title={b.title}
            onMouseDown={e => { e.preventDefault(); exec(b.cmd, b.value); }}
          >{b.icon}</button>
        ))}
        <div className={styles.fmtSep} />
        {LIST_BTNS.map(b => (
          <button
            key={b.cmd}
            className={styles.fmtBtn}
            title={b.title}
            onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
          >{b.icon}</button>
        ))}
        <button
          className={styles.fmtBtn}
          title="Checklist"
          onMouseDown={e => { e.preventDefault(); insertChecklist(); }}
        >☑</button>
        <div className={styles.fmtSep} />
        <div className={styles.tableBtnWrap}>
          <button
            className={styles.fmtBtn}
            title="Insert Table"
            onMouseDown={e => { e.preventDefault(); saveRange(); setShowTablePicker(p => !p); }}
          >⊞</button>
          {showTablePicker && (
            <div className={styles.tablePicker}>
              <div className={styles.tablePickerTitle}>Insert Table</div>
              <label className={styles.tablePickerLabel}>
                Rows
                <input type="number" min={1} max={20} value={tableRows}
                  onChange={e => setTableRows(+e.target.value)} className={styles.tablePickerInput} />
              </label>
              <label className={styles.tablePickerLabel}>
                Columns
                <input type="number" min={1} max={10} value={tableCols}
                  onChange={e => setTableCols(+e.target.value)} className={styles.tablePickerInput} />
              </label>
              <button className="btn sm accent" onMouseDown={e => { e.preventDefault(); insertTable(); }}>
                Insert
              </button>
            </div>
          )}
        </div>
        <button
          className={styles.fmtBtn}
          title="Horizontal Rule"
          onMouseDown={e => { e.preventDefault(); exec('insertHorizontalRule'); }}
        >—</button>
        <div className={styles.fmtSep} />
        <button
          className={styles.fmtBtn}
          title="Clear Formatting"
          onMouseDown={e => { e.preventDefault(); exec('removeFormat'); exec('formatBlock', 'p'); }}
        >Tx</button>
      </div>

      {/* Content area */}
      <div
        ref={editorRef}
        className={styles.content}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder="Start writing…"
        spellCheck
      />
    </div>
  );
}
