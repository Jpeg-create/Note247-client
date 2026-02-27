import styles from './TemplateModal.module.css';

const TEMPLATES = [
  {
    id: 'blank',
    icon: '📄',
    title: 'Blank Document',
    desc: 'Start with an empty page.',
    mode: 'richtext',
    docTitle: 'Untitled',
    content: '',
  },
  {
    id: 'meeting',
    icon: '📋',
    title: 'Meeting Notes',
    desc: 'Agenda, attendees, action items.',
    mode: 'richtext',
    docTitle: 'Meeting Notes',
    content: `<h1>Meeting Notes</h1>
<p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
<p><strong>Attendees:</strong> </p>
<hr>
<h2>Agenda</h2>
<ol><li><br></li><li><br></li><li><br></li></ol>
<h2>Discussion</h2>
<p><br></p>
<h2>Decisions Made</h2>
<p><br></p>
<h2>Action Items</h2>
<ul class="rt-checklist">
  <li class="rt-task"><input type="checkbox" class="rt-checkbox"><span>Owner — Task description</span></li>
  <li class="rt-task"><input type="checkbox" class="rt-checkbox"><span>Owner — Task description</span></li>
</ul>
<h2>Next Meeting</h2>
<p><br></p>`,
  },
  {
    id: 'todo',
    icon: '✅',
    title: 'To-Do List',
    desc: 'Simple checklist to track tasks.',
    mode: 'richtext',
    docTitle: 'My To-Do List',
    content: `<h1>To-Do List</h1>
<p style="color:var(--text-muted);font-size:14px">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
<h2>Today</h2>
<ul class="rt-checklist">
  <li class="rt-task"><input type="checkbox" class="rt-checkbox"><span>Task one</span></li>
  <li class="rt-task"><input type="checkbox" class="rt-checkbox"><span>Task two</span></li>
  <li class="rt-task"><input type="checkbox" class="rt-checkbox"><span>Task three</span></li>
</ul>
<h2>This Week</h2>
<ul class="rt-checklist">
  <li class="rt-task"><input type="checkbox" class="rt-checkbox"><span>Bigger task</span></li>
  <li class="rt-task"><input type="checkbox" class="rt-checkbox"><span>Another goal</span></li>
</ul>
<h2>Notes</h2>
<p><br></p>`,
  },
  {
    id: 'journal',
    icon: '📓',
    title: 'Journal Entry',
    desc: 'Daily reflection and notes.',
    mode: 'richtext',
    docTitle: `Journal — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    content: `<h1>${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h1>
<h2>How I'm feeling</h2>
<p><br></p>
<h2>What happened today</h2>
<p><br></p>
<h2>What I'm grateful for</h2>
<ul><li><br></li><li><br></li><li><br></li></ul>
<h2>What I want to do tomorrow</h2>
<ul class="rt-checklist">
  <li class="rt-task"><input type="checkbox" class="rt-checkbox"><span><br></span></li>
</ul>`,
  },
  {
    id: 'project',
    icon: '🚀',
    title: 'Project Brief',
    desc: 'Goals, scope, timeline.',
    mode: 'richtext',
    docTitle: 'Project Brief',
    content: `<h1>Project Brief</h1>
<table class="rt-table"><tbody>
<tr><th>Project Name</th><td contenteditable="true"><br></td></tr>
<tr><th>Owner</th><td contenteditable="true"><br></td></tr>
<tr><th>Start Date</th><td contenteditable="true"><br></td></tr>
<tr><th>Target Date</th><td contenteditable="true"><br></td></tr>
<tr><th>Status</th><td contenteditable="true">Planning</td></tr>
</tbody></table>
<h2>Overview</h2>
<p>One paragraph describing what this project is and why it matters.</p>
<h2>Goals</h2>
<ol><li><br></li><li><br></li><li><br></li></ol>
<h2>Out of Scope</h2>
<ul><li><br></li></ul>
<h2>Milestones</h2>
<table class="rt-table"><tbody>
<tr><th>Milestone</th><th>Due Date</th><th>Owner</th></tr>
<tr><td contenteditable="true"><br></td><td contenteditable="true"><br></td><td contenteditable="true"><br></td></tr>
<tr><td contenteditable="true"><br></td><td contenteditable="true"><br></td><td contenteditable="true"><br></td></tr>
</tbody></table>
<h2>Risks</h2>
<p><br></p>`,
  },
  {
    id: 'code',
    icon: '💻',
    title: 'Code Document',
    desc: 'Syntax-highlighted code editor.',
    mode: 'code',
    docTitle: 'Untitled',
    content: '',
    language: 'javascript',
  },
];

export default function TemplateModal({ onSelect, onClose }) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.headerIcon}>✨</span>
            New Document
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <p className={styles.subtitle}>Choose a starting point</p>
        <div className={styles.grid}>
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              className={styles.card}
              onClick={() => onSelect(t)}
            >
              <div className={styles.cardIcon}>{t.icon}</div>
              <div className={styles.cardTitle}>{t.title}</div>
              <div className={styles.cardDesc}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
