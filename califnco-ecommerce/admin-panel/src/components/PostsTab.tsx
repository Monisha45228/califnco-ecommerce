import React, { useEffect, useState } from 'react';
import { ImagePlus, Loader2, Pencil, Plus, RefreshCw, Send, Trash2, Upload, X } from 'lucide-react';
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { MarketingPost } from '../types';
import { adminStore } from '../services/store';
import { db } from '../services/firebase';

type InstagramStatus = 'draft' | 'scheduled' | 'posted' | 'failed';
type InstagramPost = MarketingPost & {
  platform?: string;
  productId?: string;
  imageUrl?: string;
  status?: InstagramStatus;
  instagramPostId?: string | null;
  postedAt?: string | null;
  scheduledAt?: string | null;
  error?: string | null;
  warnings?: string[];
  source?: string;
  automationAction?: string;
};
type PostDraft = Omit<MarketingPost, 'id' | 'createdAt'> & {
  status?: 'draft' | 'scheduled';
  productId?: string;
  scheduledAt?: string;
};

const emptyPost: PostDraft = { title: '', caption: '', image: '', hashtags: [], active: true };
const statusClasses: Record<InstagramStatus, string> = {
  draft: 'bg-amber-100 text-amber-800',
  scheduled: 'bg-sky-100 text-sky-800',
  posted: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800'
};

function isInstagramPost(post: InstagramPost) {
  return Boolean(post.productId || post.source || post.status);
}

function toLocalDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function postErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const PostsTab: React.FC<{ posts: MarketingPost[] }> = ({ posts }) => {
  const allPosts = posts as InstagramPost[];
  const instagramPosts = allPosts.filter(post => post.platform !== 'whatsapp_status');
  const whatsappPosts = allPosts.filter(post => post.platform === 'whatsapp_status');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingInstagramPost, setEditingInstagramPost] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<PostDraft>(emptyPost);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(draft.image);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile, draft.image]);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        if (!db) throw new Error('Firebase is not configured.');
        const settings = await getDoc(doc(db, 'automationSettings', 'instagram'));
        if (mounted) setAutoApprove(settings.exists() && settings.data().autoApprove === true);
      } catch (settingsError) {
        if (mounted) setError(postErrorMessage(settingsError, 'Unable to load Instagram approval settings.'));
      } finally {
        if (mounted) setLoadingSettings(false);
      }
    };
    void loadSettings();
    return () => { mounted = false; };
  }, []);

  const openNew = () => {
    setEditingId(null);
    setEditingInstagramPost(false);
    setDraft({ ...emptyPost });
    setImageFile(null);
    setEditorOpen(true);
    setError('');
  };

  const openEdit = (post: InstagramPost) => {
    setEditingId(post.id);
    setEditingInstagramPost(isInstagramPost(post));
    setDraft({
      ...emptyPost,
      ...post,
      status: post.status === 'scheduled' ? 'scheduled' : 'draft',
      scheduledAt: toLocalDateTime(post.scheduledAt)
    });
    setImageFile(null);
    setEditorOpen(true);
    setError('');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.caption.trim() || (!draft.image.trim() && !imageFile)) {
      setError('Title, caption, and an image URL or uploaded image are required.');
      return;
    }
    if (editingInstagramPost && draft.status === 'scheduled' && !draft.scheduledAt) {
      setError('Choose a date and time for this scheduled post.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const id = editingId || `post-${crypto.randomUUID()}`;
      const image = imageFile ? await adminStore.uploadPostImage(imageFile, id) : draft.image.trim();
      const post = {
        ...draft,
        id,
        title: draft.title.trim(),
        caption: draft.caption.trim(),
        image,
        hashtags: draft.hashtags
      };
      await adminStore.savePost(post);
      if (editingInstagramPost && db) {
        await setDoc(doc(db, 'posts', id), {
          imageUrl: image,
          status: draft.status || 'draft',
          active: false,
          ...(draft.status === 'scheduled'
            ? { scheduledAt: new Date(draft.scheduledAt || '').toISOString() }
            : {}),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      setEditorOpen(false);
    } catch (saveError) {
      setError(postErrorMessage(saveError, 'Unable to save post.'));
    } finally {
      setSaving(false);
    }
  };

  const updateAutomation = async (post: InstagramPost, changes: Record<string, unknown>) => {
    if (!db) {
      setError('Firebase is not configured.');
      return;
    }
    setBusyPostId(post.id);
    setError('');
    try {
      await setDoc(doc(db, 'posts', post.id), {
        ...changes,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (actionError) {
      setError(postErrorMessage(actionError, 'Unable to queue Instagram action.'));
    } finally {
      setBusyPostId(null);
    }
  };

  const postNow = (post: InstagramPost) => updateAutomation(post, {
    status: 'scheduled',
    scheduledAt: new Date().toISOString(),
    active: false,
    error: null,
    automationAction: deleteField()
  });

  const queueRegeneration = (post: InstagramPost, action: 'regenerate_caption' | 'regenerate_image') =>
    updateAutomation(post, { automationAction: action, error: null });

  const saveApprovalSetting = async (checked: boolean) => {
    if (!db) {
      setError('Firebase is not configured.');
      return;
    }
    setError('');
    try {
      await setDoc(doc(db, 'automationSettings', 'instagram'), {
        autoApprove: checked,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setAutoApprove(checked);
    } catch (settingsError) {
      setError(postErrorMessage(settingsError, 'Unable to save approval setting.'));
    }
  };

  const remove = async (post: InstagramPost) => {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    setError('');
    try {
      await adminStore.deletePost(post.id);
    } catch (deleteError) {
      setError(postErrorMessage(deleteError, 'Unable to delete post.'));
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Marketing posts</h2>
          <p className="text-xs text-slate-500">Instagram and WhatsApp automation records, plus customer-facing posts in Firestore.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Plus className="h-4 w-4" />New post</button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-bold text-slate-900">Automatic approval</p>
          <p className="text-xs text-slate-500">When enabled, the daily GitHub workflow publishes its generated post. Otherwise it saves a draft for review.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={autoApprove} disabled={loadingSettings} onChange={event => void saveApprovalSetting(event.target.checked)} />
          Auto-approve and publish
        </label>
      </div>
      <p className="text-xs text-slate-500">Post-now and regeneration requests are processed by the GitHub Actions queue (scheduled every 5 minutes). Queue execution requires the repository secrets to be configured.</p>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {editorOpen && <form onSubmit={event => void save(event)} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between"><h3 className="font-bold">{editingId ? 'Edit post' : 'Create post'}</h3><button type="button" onClick={() => setEditorOpen(false)} aria-label="Close editor"><X className="h-4 w-4" /></button></div>
        <input required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Post title" className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
        <textarea required value={draft.caption} onChange={event => setDraft({ ...draft, caption: event.target.value })} placeholder="Caption" rows={3} className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
        <input required={!imageFile} type="url" value={draft.image} onChange={event => { setDraft({ ...draft, image: event.target.value }); setImageFile(null); }} placeholder="Image URL (https://…)" className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><Upload className="h-4 w-4" />Upload image to Cloudinary<input type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0] || null; setImageFile(file); if (file) setDraft({ ...draft, image: '' }); event.currentTarget.value = ''; }} /></label>
        {imageFile && <p className="text-xs text-slate-500">{imageFile.name} will upload when you save.</p>}
        <input value={draft.hashtags.join(', ')} onChange={event => setDraft({ ...draft, hashtags: event.target.value.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(Boolean) })} placeholder="Hashtags, comma-separated" className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
        {editingInstagramPost && <>
          <label className="block text-xs font-semibold text-slate-600">Workflow status
            <select value={draft.status || 'draft'} onChange={event => setDraft({ ...draft, status: event.target.value as 'draft' | 'scheduled' })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">
              <option value="draft">Draft (needs approval)</option><option value="scheduled">Scheduled</option>
            </select>
          </label>
          {draft.status === 'scheduled' && <label className="block text-xs font-semibold text-slate-600">Publish at
            <input required type="datetime-local" value={draft.scheduledAt || ''} onChange={event => setDraft({ ...draft, scheduledAt: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
          </label>}
        </>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} />Show to customers</label>
        <div className="flex items-center gap-4">{previewUrl ? <img src={previewUrl} alt="Post preview" className="h-24 w-24 rounded-xl bg-slate-100 object-cover" onError={() => setError('Post image could not be loaded; verify the URL before saving.')} /> : <span className="flex h-24 w-24 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><ImagePlus /></span>}<button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving…' : 'Save post'}</button></div>
      </form>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {instagramPosts.map(post => {
          const automated = isInstagramPost(post);
          const actionPending = Boolean(post.automationAction);
          return <article key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <img src={post.image || post.imageUrl} alt={post.title} className="h-44 w-full bg-slate-100 object-cover" />
            <div className="space-y-2 p-4">
              <div className="flex justify-between gap-2"><h3 className="font-bold">{post.title}</h3><span className={`h-fit rounded-full px-2 py-1 text-[10px] font-bold ${post.status ? statusClasses[post.status] : post.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{post.status || (post.active ? 'Live' : 'Hidden')}</span></div>
              <p className="line-clamp-3 text-xs text-slate-600">{post.caption}</p>
              <p className="text-[10px] text-sky-700">{post.hashtags.map(tag => `#${tag}`).join(' ')}</p>
              {post.error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{post.error}</p>}
              {post.warnings?.map(warning => <p key={warning} className="text-[10px] text-amber-700">{warning}</p>)}
              {actionPending && <p className="text-xs font-semibold text-amber-700">Queued: {post.automationAction?.replace('_', ' ')}</p>}
              {post.instagramPostId && <p className="text-[10px] text-slate-500">Instagram ID: {post.instagramPostId}</p>}
              <div className="flex gap-2">
                {(!automated || post.status === 'draft' || post.status === 'scheduled') && <button onClick={() => openEdit(post)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-sky-50 py-2 text-xs font-bold text-sky-700"><Pencil className="h-3 w-3" />Edit</button>}
                {automated && post.status !== 'posted' && <>
                  <button disabled={busyPostId === post.id || actionPending} onClick={() => void postNow(post)} title="Queue this post for immediate publishing" className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50"><Send className="h-3 w-3" />Post now</button>
                  <button disabled={busyPostId === post.id || actionPending} onClick={() => void queueRegeneration(post, 'regenerate_caption')} title="Regenerate caption with Gemini" className="rounded-lg bg-violet-50 px-2 text-violet-700 disabled:opacity-50"><RefreshCw className="h-3 w-3" /></button>
                  <button disabled={busyPostId === post.id || actionPending} onClick={() => void queueRegeneration(post, 'regenerate_image')} title="Regenerate or replace the image" className="rounded-lg bg-violet-50 px-2 text-violet-700 disabled:opacity-50"><ImagePlus className="h-3 w-3" /></button>
                </>}
                <button onClick={() => void remove(post)} aria-label={`Delete ${post.title}`} className="rounded-lg bg-rose-50 px-3 text-rose-700"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </article>;
        })}
        {posts.length === 0 && <p className="col-span-full rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">No posts in Firestore yet.</p>}
      </div>

      {whatsappPosts.length > 0 && <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">WhatsApp Status history</h3>
          <p className="text-xs text-slate-500">Daily WAHA publications from the secondary WhatsApp number.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {whatsappPosts.map(post => (
            <article key={post.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <img src={post.image || post.imageUrl} alt={post.title} className="h-20 w-20 rounded-lg bg-slate-100 object-cover" />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-xs font-bold text-slate-900">{post.title}</h4>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${post.status ? statusClasses[post.status] : 'bg-slate-100 text-slate-600'}`}>{post.status || 'unknown'}</span>
                </div>
                <p className="line-clamp-2 text-xs text-slate-600">{post.caption}</p>
                {post.error && <p role="alert" className="text-[10px] text-rose-700">{post.error}</p>}
                {post.warnings?.map(warning => <p key={warning} className="text-[10px] text-amber-700">{warning}</p>)}
              </div>
            </article>
          ))}
        </div>
      </section>}
    </section>
  );
};
