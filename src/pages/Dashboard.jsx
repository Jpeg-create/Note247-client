import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../utils/api';
import TemplateModal from '../components/TemplateModal';
import styles from './Dashboard.module.css';

const FOLDER_COLORS = ['#e8ff47','#47ffb8','#ff6b9d','#69b3ff','#ff9f47','#c084fc'];

const langColors = {
  javascript: '#f7df1e', typescript: '#3178c6', python: '#3572A5',
  html: '#e34c26', css: '#563d7c', json: '#47ffb8',
  markdown: '#69b3ff', sql: '#e38c00', rust: '#ce422b',
  plaintext: '#7070a0',
};

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [docs, setDocs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFolder, setActiveFolder] = useState(null); // null = all docs
  const [collapsedFolders, setCollapsedFolders] = useState({});

  // New folder modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);
  const [folderLoading, setFolderLoading] = useState(false);

  // Move doc dropdown
  const [moveDoc, setMoveDoc] = useState(null); // shortId of doc being moved

  // Templates
  const [showTemplates, setShowTemplates] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setError('');
    try {
      const [docsRes, foldersRes] = await Promise.all([
        api.get('/docs'),
        api.get('/folders'),
      ]);
      setDocs(docsRes.data.documents);
      setFolders(foldersRes.data.folders);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load documents.'));
    } finally {
      setLoading(false);
    }
  };

  const newDoc = () => setShowTemplates(true);

  const createDocFromTemplate = async (template) => {
    setShowTemplates(false);
    setError('');
    try {
      const language = template.mode === 'code' ? (template.language || 'javascript') : 'richtext';
      const body = { title: template.docTitle || 'Untitled', content: template.content || '', language };
      if (activeFolder && activeFolder !== 'unfiled') body.folder_id = activeFolder;
      const res = await api.post('/docs', body);
      navigate(`/s/${res.data.document.short_id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create document.'));
    }
  };

  const deleteDoc = async (shortId) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try {
      await api.delete(`/docs/${shortId}`);
      setDocs(prev => prev.filter(d => d.short_id !== shortId));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete document.'));
    }
  };

  const copyLink = async (shortId) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/s/${shortId}`); }
    catch { setError('Could not copy link.'); }
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    setFolderLoading(true);
    try {
      const res = await api.post('/folders', { name: folderName.trim(), color: folderColor });
      setFolders(prev => [...prev, { ...res.data.folder, doc_count: 0 }]);
      setFolderName('');
      setShowFolderModal(false);
    } catch (err) {
      setError('Could not create folder.');
    } finally {
      setFolderLoading(false);
    }
  };

  const deleteFolder = async (folderId) => {
    if (!window.confirm('Delete folder? Documents inside will become unfiled.')) return;
    try {
      await api.delete(`/folders/${folderId}`);
      setFolders(prev => prev.filter(f => f.id !== folderId));
      setDocs(prev => prev.map(d => d.folder_id === folderId ? { ...d, folder_id: null } : d));
      if (activeFolder === folderId) setActiveFolder(null);
    } catch { setError('Could not delete folder.'); }
  };

  const moveDocToFolder = async (shortId, folderId) => {
    try {
      await api.put(`/folders/assign/${shortId}`, { folderId });
      setDocs(prev => prev.map(d => d.short_id === shortId ? { ...d, folder_id: folderId } : d));
      setMoveDoc(null);
    } catch { setError('Could not move document.'); }
  };

  const toggleFolder = (folderId) => {
    setCollapsedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Filtered docs
  const folderDocs = activeFolder === null
    ? docs
    : activeFolder === 'unfiled'
    ? docs.filter(d => !d.folder_id)
    : docs.filter(d => d.folder_id === activeFolder);
  const visibleDocs = searchQuery.trim()
    ? docs.filter(d => d.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : folderDocs;

  const unfiledCount = docs.filter(d => !d.folder_id).length;

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.logo} onClick={() => navigate('/')}>Note<span>247</span></div>
        <div className={styles.headerRight}>
          <span className={styles.username}>@{user?.username}</span>
          <button className="btn sm ghost" onClick={() => navigate(`/u/${user?.username}`)}>Profile</button>
          <button className="btn sm ghost" onClick={() => { logout(); navigate('/'); }}>Logout</button>
          <button className="btn sm accent" onClick={newDoc}>+ New</button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <button
              className={`${styles.sidebarItem} ${activeFolder === null ? styles.sidebarActive : ''}`}
              onClick={() => setActiveFolder(null)}
            >
              <span>📄</span> All Documents
              <span className={styles.sidebarCount}>{docs.length}</span>
            </button>
            <button
              className={`${styles.sidebarItem} ${activeFolder === 'unfiled' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveFolder('unfiled')}
            >
              <span>📋</span> Unfiled
              <span className={styles.sidebarCount}>{unfiledCount}</span>
            </button>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarHeader}>
              <span>Folders</span>
              <button className={styles.sidebarAdd} onClick={() => setShowFolderModal(true)} title="New folder">＋</button>
            </div>
            {folders.map(f => (
              <div key={f.id} className={styles.folderRow}>
                <button
                  className={`${styles.sidebarItem} ${activeFolder === f.id ? styles.sidebarActive : ''}`}
                  onClick={() => setActiveFolder(f.id)}
                >
                  <span className={styles.folderDot} style={{ background: f.color }} />
                  <span className={styles.folderName}>{f.name}</span>
                  <span className={styles.sidebarCount}>{f.doc_count}</span>
                </button>
                <button className={styles.folderDelete} onClick={() => deleteFolder(f.id)} title="Delete folder">×</button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <h1>
              {searchQuery.trim() ? `Search: "${searchQuery}"` : activeFolder === null ? 'All Documents' : activeFolder === 'unfiled' ? 'Unfiled' : folders.find(f => f.id === activeFolder)?.name || 'Documents'}
            </h1>
            <div className={styles.pageHeaderRight}>
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  type="search"
                  placeholder="Search documents…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className={styles.searchClear} onClick={() => setSearchQuery('')}>×</button>
                )}
              </div>
              <button className="btn accent" onClick={newDoc}>+ New Document</button>
            </div>
          </div>

          {error && <div className="form-error" style={{ marginBottom: 16 }} role="alert">{error}</div>}

          {loading ? (
            <div className={styles.empty}><div className={styles.spinner} /></div>
          ) : visibleDocs.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>DOC</div>
              <h3>No documents here</h3>
              <p>Create your first document to get started.</p>
              <button className="btn accent" onClick={newDoc}>Create Document</button>
            </div>
          ) : (
            <div className={styles.grid}>
              {visibleDocs.map(doc => (
                <div
                  key={doc.id}
                  className={styles.docCard}
                  onClick={() => navigate(`/s/${doc.short_id}`)}
                >
                  <div className={styles.docHeader}>
                    <span className={styles.docTitle}>{doc.title || 'Untitled'}</span>
                    <span className={styles.docLang} style={{ color: langColors[doc.language] || '#7070a0' }}>
                      {doc.language}
                    </span>
                  </div>
                  <div className={styles.docMeta}>
                    <span>{timeAgo(doc.updated_at)}</span>
                    {doc.is_public && <span className="badge green">Public</span>}
                    {doc.folder_name && (
                      <span className={styles.folderTag} style={{ borderColor: doc.folder_color, color: doc.folder_color }}>
                        {doc.folder_name}
                      </span>
                    )}
                  </div>
                  <div className={styles.docActions} onClick={e => e.stopPropagation()}>
                    <button className="btn sm ghost" onClick={() => copyLink(doc.short_id)}>🔗</button>
                    <div className={styles.moveWrap}>
                      <button className="btn sm ghost" onClick={() => setMoveDoc(moveDoc === doc.short_id ? null : doc.short_id)}>
                        📁 Move
                      </button>
                      {moveDoc === doc.short_id && (
                        <div className={styles.moveDropdown}>
                          <button className={styles.moveItem} onClick={() => moveDocToFolder(doc.short_id, null)}>📋 Unfiled</button>
                          {folders.map(f => (
                            <button key={f.id} className={styles.moveItem} onClick={() => moveDocToFolder(doc.short_id, f.id)}>
                              <span className={styles.folderDot} style={{ background: f.color }} />{f.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="btn sm ghost" onClick={() => deleteDoc(doc.short_id)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* New folder modal */}
      {showFolderModal && (
        <div className="overlay" onClick={() => setShowFolderModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Folder</h2>
            <div className="form-group">
              <label className="form-label">Folder name</label>
              <input className="form-input" placeholder="e.g. Work, Personal…"
                value={folderName} onChange={e => setFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createFolder()} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div className={styles.colorPicker}>
                {FOLDER_COLORS.map(c => (
                  <button key={c} className={`${styles.colorSwatch} ${folderColor === c ? styles.colorSwatchActive : ''}`}
                    style={{ background: c }} onClick={() => setFolderColor(c)} />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowFolderModal(false)}>Cancel</button>
              <button className="btn accent" onClick={createFolder} disabled={folderLoading || !folderName.trim()}>
                {folderLoading ? 'Creating…' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showTemplates && (
        <TemplateModal onSelect={createDocFromTemplate} onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
}
