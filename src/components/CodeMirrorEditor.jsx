import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, search } from '@codemirror/search';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { php } from '@codemirror/lang-php';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubLight } from '@uiw/codemirror-theme-github';
import styles from './CodeMirrorEditor.module.css';

const getLang = (language) => {
  switch (language) {
    case 'javascript':
    case 'typescript': return javascript({ typescript: language === 'typescript' });
    case 'python': return python();
    case 'html': return html();
    case 'css': return css();
    case 'json': return json();
    case 'markdown': return markdown();
    case 'sql': return sql();
    case 'java': return java();
    case 'cpp': return cpp();
    case 'rust': return rust();
    case 'php': return php({ plain: true });
    default: return [];
  }
};

export default function CodeMirrorEditor({ value, language, isDark, onChange, onCursorChange }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onCursorRef = useRef(onCursorChange);

  onChangeRef.current = onChange;
  onCursorRef.current = onCursorChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: createState(value, language, isDark),
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  // Update language or theme
  useEffect(() => {
    if (!viewRef.current) return;
    const currentVal = viewRef.current.state.doc.toString();
    viewRef.current.setState(createState(currentVal, language, isDark));
  }, [language, isDark]);

  // Update content from outside (remote changes)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  function createState(doc, lang, dark) {
    const langExt = getLang(lang);
    return EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        search({ top: true }),
        autocompletion(),
        dark ? oneDark : githubLight,
        Array.isArray(langExt) ? langExt : [langExt],
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newVal = update.state.doc.toString();
            onChangeRef.current?.(newVal);
          }
          if (update.selectionSet) {
            const pos = update.state.selection.main.head;
            const line = update.state.doc.lineAt(pos);
            onCursorRef.current?.({ line: line.number, col: pos - line.from + 1 });
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.7', overflow: 'auto' },
          '.cm-content': { padding: '16px 0' },
          '.cm-line': { padding: '0 20px' },
        }),
      ],
    });
  }

  return <div ref={containerRef} className={styles.editor} />;
}
