import React, { useEffect, useMemo, useState } from 'react';
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

/** Builds an image prompt from the real product data so the picture matches the product and caption. */
const buildImagePrompt = (product: ProductDraft): string =>
  [
    `Professional commercial product photograph of ${product.name.trim() || 'water purification equipment'}`,
    `category: ${product.category}`,
    product.description.trim() ? `details: ${product.description.trim().slice(0, 150)}` : '',
    product.caption?.trim() ? `theme: ${product.caption.trim().slice(0, 100)}` : '',
    'single product centered, white studio background, soft lighting, realistic, high quality, no text, no watermark, no people'
  ]
    .filter(Boolean)
    .join(', ');

/** New random seed on every call, so every click gives a different image. */
const buildImageUrl = (prompt: string, seed: number): string =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=900&height=900&nologo=true&model=flux&seed=${seed}`;

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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(draft.image);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile, draft.image]);

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

  /** Generates a NEW image every click: fresh seed, prompt built from this product's data. */
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
      const response = await fetch(url, { cache: 'no-store' });
      const type = response.headers.get('content-type') || '';
      console.log('AI IMAGE | status:', response.status, '| type:', type);
      if (!response.ok) throw new Error(`Image service returned ${response.status}`);
      if (!type.startsWith('image/')) throw new Error('Image service did not return an image');

      const blob = await response.blob();
      const extension = type.includes('png') ? 'png' : 'jpg';
      // Kept as a file so it is uploaded to your storage on Save (permanent, not a changing link).
      setImageFile(new File([blob], `ai-${seed}.${extension}`, { type: blob.type || type }));
      setDraft(current => ({ ...current, image: '' }));
      setImageNote(`New image generated (seed ${seed}). Click again for another one, or edit the prompt below.`);
    } catch (generationError) {
      console.error('AI image failed:', generationError);
      // Fallback: still use the seeded URL so the admin sees something new; they can retry or upload.
      setImageFile(null);
      setDraft(current => ({ ...current, image: url }));
      setImageNote('Could not download the image, so the live link is used instead. If it looks wrong, retry or upload your own.');
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
                AI image prompt (optional – leave empty to build it from the product details)
                <textarea
                  value={imagePrompt}
                  onChange={event => setImagePrompt(event.target.value)}
                  rows={2}
                  placeholder={buildImagePrompt(draft)}
                  className={inputClass}
                />
              </label>

              <div className="flex flex-wrap gap-2">
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
                  disabled={imageBusy}
                  onClick={() => void regenerateImage()}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 disabled:opacity-50"
                >
                  {imageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {imageBusy ? 'Generating…' : 'Regenerate with AI'}
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