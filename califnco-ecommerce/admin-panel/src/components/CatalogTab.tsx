import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, Pencil, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { Product, ProductCategory } from '../types';
import { adminStore } from '../services/store';

interface CatalogTabProps {
  products: Product[];
}

type ProductDraft = Omit<Product, 'id'>;

const categories: ProductCategory[] = ['purifiers', 'dispensers', 'pumps', 'filters', 'spares'];

const emptyDraft: ProductDraft = {
  name: '',
  category: 'purifiers',
  retailPrice: 0,
  wholesalePrice: 0,
  moq: 1,
  rating: 0,
  reviewsCount: 0,
  inStock: false,
  stock: 0,
  image: '',
  description: '',
  caption: '',
  hashtags: [],
  specifications: {},
  featured: false
};

const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm';
const labelClass = 'text-xs font-semibold text-slate-600';

const categoryKeyword: Record<ProductCategory, string> = {
  purifiers: 'RO water purifier',
  dispensers: 'water dispenser',
  pumps: 'water pump',
  filters: 'water filter cartridge',
  spares: 'water purifier spare part'
};

/** Short, product-type-first prompt. Long descriptions/captions confuse the AI, so they are not used. */
const buildImagePrompt = (product: ProductDraft): string => {
  const type = categoryKeyword[product.category];
  const name = product.name.trim().split(/\s+/).slice(0, 6).join(' ');
  return `Product photo of a ${type}${name ? `, ${name}` : ''}, single object, white background, studio lighting, no text, no people`;
};

/** New random seed on every call, so every click gives a different image. */
const buildImageUrl = (prompt: string, seed: number): string =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=900&height=900&nologo=true&seed=${seed}`;

export const CatalogTab: React.FC<CatalogTabProps> = ({ products }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [newSpecificationKey, setNewSpecificationKey] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageNote, setImageNote] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const usedPhotoIds = useRef<Set<number>>(new Set());

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
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const filtered = useMemo(
    () =>
      products.filter(product => {
        const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
        const matchesSearch = `${product.name} ${product.id} ${product.description}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
      }),
    [products, selectedCategory, searchTerm]
  );

  const resetImageState = () => {
    setImageFile(null);
    setImagePrompt('');
    setImageNote('');
    usedPhotoIds.current = new Set();
  };

  const startNew = () => {
    setEditorOpen(true);
    setEditingId(null);
    setDraft({ ...emptyDraft });
    setNewSpecificationKey('');
    resetImageState();
    setError('');
  };

  const startEdit = (product: Product) => {
    const { id, ...productFields } = product;
    const stored = productFields as ProductDraft & { imageUrl?: string };
    const stock = Number(stored.stock ?? 0);
    setEditingId(id);
    setDraft({
      ...emptyDraft,
      ...stored,
      retailPrice: Number(stored.retailPrice ?? 0),
      wholesalePrice: Number(stored.wholesalePrice ?? 0),
      moq: Number(stored.moq ?? 1),
      rating: Number(stored.rating ?? 0),
      reviewsCount: Number(stored.reviewsCount ?? 0),
      stock,
      inStock: Boolean(stored.inStock ?? stock > 0),
      image: String(stored.image || stored.imageUrl || ''),
      caption: String(stored.caption || ''),
      hashtags: Array.isArray(stored.hashtags) ? stored.hashtags : [],
      specifications: { ...(stored.specifications || {}) }
    });
    setNewSpecificationKey('');
    setEditorOpen(true);
    resetImageState();
    setError('');
  };

  /** AI image: fresh seed on every click. The free anonymous service may refuse requests (402/403/429). */
  const regenerateImage = async () => {
    if (!draft.name.trim()) {
      setError('Enter the product name first so the image matches the product.');
      return;
    }
    setError('');
    setImageNote('');
    setImageBusy(true);

    const prompt = imagePrompt.trim() || buildImagePrompt(draft);
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const url = buildImageUrl(prompt, seed);
    console.log('AI IMAGE | product:', draft.name, '| prompt:', prompt, '| seed:', seed);

    try {
      let response: Response;
      try {
        response = await fetch(url, { cache: 'no-store' });
      } catch {
        throw new Error('Could not reach the AI image service (blocked or offline).');
      }
      const type = response.headers.get('content-type') || '';
      console.log('AI IMAGE | status:', response.status, '| type:', type);
      if (response.status === 402 || response.status === 403) {
        throw new Error(
          `The free AI image service now blocks anonymous requests (error ${response.status}). Use "Find real photo" or "Upload image".`
        );
      }
      if (response.status === 429) throw new Error('The free AI service is busy. Wait 15 seconds and try again.');
      if (!response.ok) throw new Error(`The AI image service returned error ${response.status}.`);
      if (!type.startsWith('image/')) throw new Error('The AI image service did not return an image.');

      const blob = await response.blob();
      const extension = type.includes('png') ? 'png' : 'jpg';
      setImageFile(new File([blob], `ai-${seed}.${extension}`, { type: blob.type || type }));
      setDraft(current => ({ ...current, image: '' }));
      setImageNote('New AI image generated. The free service allows one image every 15 seconds.');
    } catch (generationError) {
      console.error('AI image failed:', generationError);
      const message = generationError instanceof Error ? generationError.message : 'AI image failed.';
      setImageNote(`⚠ ${message} Your previous image was kept.`);
    } finally {
      setImageBusy(false);
      setCooldown(15);
    }
  };

  /** Real photo search (Pixabay). The photo is downloaded so it is stored in your own Cloudinary on Save. */
  const findStockPhoto = async () => {
    const apiKey = import.meta.env.VITE_PIXABAY_API_KEY as string | undefined;
    console.log('Pixabay key loaded:', Boolean(apiKey));
    if (!apiKey) {
      setImageNote('⚠ Add VITE_PIXABAY_API_KEY to admin-panel/.env, then stop and restart npm run dev.');
      return;
    }
    setError('');
    setImageNote('');
    setImageBusy(true);
    try {
      type PixabayHit = { id: number; webformatURL: string; largeImageURL: string };
      const search = async (term: string, page: number) => {
        const response = await fetch(
          `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(term)}&image_type=photo&per_page=20&page=${page}&safesearch=true`
        );
        if (response.status === 400) throw new Error('Pixabay rejected the request. Check that your API key is correct.');
        if (response.status === 429) throw new Error('Pixabay limit reached. Wait a minute and try again.');
        if (!response.ok) throw new Error(`Photo search failed (${response.status}).`);
        const data = (await response.json()) as { hits: PixabayHit[] };
        return data.hits;
      };

      // Short search words work best. The full product name or model number usually finds nothing.
      const term = imagePrompt.trim() || categoryKeyword[draft.category];
      let hits = await search(term, Math.ceil(Math.random() * 3));
      if (!hits.length) hits = await search(term, 1);
      if (!hits.length) hits = await search(categoryKeyword[draft.category], 1);
      if (!hits.length) throw new Error('No photos found. Type simpler words in the box, such as "water purifier".');

      const fresh = hits.filter(item => !usedPhotoIds.current.has(item.id));
      const pool = fresh.length ? fresh : hits;
      const hit = pool[Math.floor(Math.random() * pool.length)];
      usedPhotoIds.current.add(hit.id);

      try {
        const imageResponse = await fetch(hit.largeImageURL);
        if (!imageResponse.ok) throw new Error('download failed');
        const blob = await imageResponse.blob();
        setImageFile(new File([blob], `pixabay-${hit.id}.jpg`, { type: blob.type || 'image/jpeg' }));
        setDraft(current => ({ ...current, image: '' }));
      } catch {
        // If the browser blocks the download, use the link directly.
        setImageFile(null);
        setDraft(current => ({ ...current, image: hit.webformatURL }));
      }
      setImageNote(`Photo found for "${term}". Click again for a different one.`);
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : 'Photo search failed.';
      setImageNote(`⚠ ${message}`);
    } finally {
      setImageBusy(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!draft.name.trim() || !draft.description.trim() || (!draft.image.trim() && !imageFile)) {
      setError('Name, description, and a product image are required.');
      return;
    }
    if (
      [draft.retailPrice, draft.wholesalePrice, draft.stock, draft.moq, draft.rating, draft.reviewsCount].some(
        value => !Number.isFinite(value) || value < 0
      ) ||
      !Number.isInteger(draft.stock) ||
      !Number.isInteger(draft.moq) ||
      draft.moq < 1 ||
      !Number.isInteger(draft.reviewsCount) ||
      draft.rating > 5
    ) {
      setError(
        'Prices and rating must be valid; rating must be 0–5, stock and reviews must be whole numbers, and minimum order quantity must be a positive whole number.'
      );
      return;
    }
    setSaving(true);
    try {
      const id = editingId || `prd-${crypto.randomUUID()}`;
      const image = imageFile ? await adminStore.uploadProductImage(imageFile, id) : draft.image.trim();
      await adminStore.saveProduct({
        ...draft,
        id,
        name: draft.name.trim(),
        description: draft.description.trim(),
        caption: (draft.caption || '').trim(),
        image,
        inStock: draft.stock > 0,
        specifications: Object.fromEntries(
          Object.entries(draft.specifications || {})
            .map(([key, value]) => [key.trim(), value?.trim() || ''])
            .filter(([key, value]) => Boolean(key && value))
        )
      });
      setEditingId(null);
      setEditorOpen(false);
      resetImageState();
      setDraft({ ...emptyDraft });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}" from the catalog?`)) return;
    setError('');
    try {
      await adminStore.deleteProduct(product.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete product.');
    }
  };

  const seedCatalog = async () => {
    setSeedBusy(true);
    setError('');
    try {
      await adminStore.seedInitialCatalog();
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : 'Unable to seed catalog.');
    } finally {
      setSeedBusy(false);
    }
  };

  const updateSpecKey = (key: string, rawKey: string) => {
    const nextKey = rawKey.trim();
    const specs = draft.specifications || {};
    if (!nextKey || (nextKey !== key && Object.prototype.hasOwnProperty.call(specs, nextKey))) return;
    const specifications = { ...specs };
    const value = specifications[key];
    delete specifications[key];
    specifications[nextKey] = value;
    setDraft({ ...draft, specifications });
  };

  const removeSpec = (key: string) => {
    const specifications = { ...draft.specifications };
    delete specifications[key];
    setDraft({ ...draft, specifications });
  };

  const addSpec = () => {
    const key = newSpecificationKey.trim();
    if (!key) return;
    setDraft({ ...draft, specifications: { ...draft.specifications, [key]: '' } });
    setNewSpecificationKey('');
  };

  const specKeyExists = Object.prototype.hasOwnProperty.call(draft.specifications || {}, newSpecificationKey.trim());

  return (
    <section className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {editorOpen && (
        <form onSubmit={event => void save(event)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">{editingId ? 'Edit product' : 'New product'}</h3>
            <button type="button" onClick={() => setEditorOpen(false)} aria-label="Close product editor" className="rounded-lg p-2 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Product name
              <input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className={inputClass} />
            </label>
            <label className={labelClass}>
              Category
              <select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as ProductCategory })} className={inputClass}>
                {categories.map(category => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>

          <label className={`block ${labelClass}`}>
            Description
            <textarea required value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} rows={3} className={inputClass} />
          </label>

          <div className="grid gap-3 sm:grid-cols-4">
            {([['Retail price', 'retailPrice'], ['Wholesale price', 'wholesalePrice'], ['Stock', 'stock'], ['Minimum order', 'moq']] as const).map(([label, key]) => (
              <label key={key} className={labelClass}>
                {label}
                <input
                  type="number"
                  min="0"
                  step={key.endsWith('Price') ? '0.01' : '1'}
                  value={draft[key]}
                  onChange={event => setDraft({ ...draft, [key]: Number(event.target.value) })}
                  className={inputClass}
                />
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Rating (0–5)
              <input type="number" min="0" max="5" step="0.1" value={draft.rating} onChange={event => setDraft({ ...draft, rating: Number(event.target.value) })} className={inputClass} />
            </label>
            <label className={labelClass}>
              Review count
              <input type="number" min="0" step="1" value={draft.reviewsCount} onChange={event => setDraft({ ...draft, reviewsCount: Number(event.target.value) })} className={inputClass} />
            </label>
          </div>

          <label className={`block ${labelClass}`}>
            Caption
            <input value={draft.caption || ''} onChange={event => setDraft({ ...draft, caption: event.target.value })} className={inputClass} />
          </label>

          <label className={`block ${labelClass}`}>
            Hashtags (comma-separated)
            <input
              value={(draft.hashtags || []).join(', ')}
              onChange={event =>
                setDraft({
                  ...draft,
                  hashtags: event.target.value.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(Boolean)
                })
              }
              className={inputClass}
            />
          </label>

          <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">Product specifications</legend>
            {Object.entries(draft.specifications || {}).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input aria-label={`Specification name ${key}`} value={key} onChange={event => updateSpecKey(key, event.target.value)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                <input
                  aria-label={`${key} value`}
                  value={value || ''}
                  onChange={event => setDraft({ ...draft, specifications: { ...draft.specifications, [key]: event.target.value } })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                />
                <button type="button" onClick={() => removeSpec(key)} aria-label={`Remove ${key} specification`} className="rounded-lg px-3 text-rose-600 hover:bg-rose-50">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={newSpecificationKey} onChange={event => setNewSpecificationKey(event.target.value)} placeholder="Add specification (e.g. warranty)" className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
              <button type="button" disabled={!newSpecificationKey.trim() || specKeyExists} onClick={addSpec} className="rounded-lg border border-slate-200 px-3 text-xs font-semibold disabled:opacity-50">
                Add field
              </button>
            </div>
          </fieldset>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={Boolean(draft.featured)} onChange={event => setDraft({ ...draft, featured: event.target.checked })} />
            Featured product
          </label>

          {/* Image section */}
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="space-y-2">
              <label className={`block ${labelClass}`}>
                Image URL
                <input
                  type="url"
                  value={draft.image}
                  onChange={event => {
                    setDraft({ ...draft, image: event.target.value });
                    setImageFile(null);
                    setImageNote('');
                  }}
                  placeholder="https://…"
                  className={inputClass}
                />
              </label>

              <label className={`block ${labelClass}`}>
                Search words / AI prompt (optional – keep it short, e.g. "water dispenser")
                <textarea
                  value={imagePrompt}
                  onChange={event => setImagePrompt(event.target.value)}
                  rows={2}
                  placeholder={categoryKeyword[draft.category]}
                  className={inputClass}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={imageBusy}
                  onClick={() => void findStockPhoto()}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                >
                  {imageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Find real photo
                </button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">
                  <Upload className="h-4 w-4" />
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={event => {
                      const file = event.target.files?.[0] || null;
                      setImageFile(file);
                      setImageNote('');
                      if (file) setDraft({ ...draft, image: '' });
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={imageBusy || cooldown > 0}
                  onClick={() => void regenerateImage()}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {imageBusy ? 'Working…' : cooldown > 0 ? `Wait ${cooldown}s` : 'Regenerate with AI'}
                </button>
              </div>

              {imageFile && <p className="text-xs text-slate-500">{imageFile.name}</p>}
              {imageNote && <p className="text-xs text-violet-700">{imageNote}</p>}
            </div>

            <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xs text-slate-400">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Product preview"
                  className="h-full w-full object-contain"
                  onError={() => setError('Image preview could not be loaded. Check the URL or upload another image.')}
                />
              ) : (
                <span className="flex items-center gap-2">
                  <ImagePlus className="h-5 w-5" />
                  Image preview
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button disabled={saving || imageBusy} type="submit" className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search products…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', ...categories].map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${selectedCategory === category ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {category === 'all' ? 'All' : category}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {products.length === 0 && (
            <button disabled={seedBusy} onClick={() => void seedCatalog()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50">
              {seedBusy ? 'Importing…' : 'Import starter catalog'}
            </button>
          )}
          <button onClick={startNew} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
            <Plus className="h-4 w-4" />
            Add product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map(product => (
          <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative h-44 bg-slate-100">
              <img src={product.image || (product as Product & { imageUrl?: string }).imageUrl || ''} alt={product.name} className="h-full w-full object-contain" />
              <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-bold text-white">{product.category}</span>
            </div>
            <div className="space-y-2 p-4">
              <p className="font-mono text-[10px] text-slate-400">{product.id}</p>
              <h4 className="line-clamp-2 text-xs font-bold text-slate-900">{product.name}</h4>
              <p className="line-clamp-2 text-[11px] text-slate-500">{product.description}</p>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-xs">
                <span>Retail ₹{product.retailPrice.toLocaleString('en-IN')}</span>
                <span>Stock {product.stock}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => startEdit(product)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-sky-50 px-2 py-2 text-xs font-bold text-sky-700">
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button onClick={() => void removeProduct(product)} className="inline-flex items-center justify-center rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700" aria-label={`Delete ${product.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">No products found.</p>}
    </section>
  );
};