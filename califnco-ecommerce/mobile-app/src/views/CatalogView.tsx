import React, { useState } from 'react';
import { Search, Star, ShoppingBag, Eye, SlidersHorizontal, Check } from 'lucide-react';
import { Product, ProductCategory, UserRole, MarketingPost } from '../types';

interface CatalogViewProps {
  products: Product[];
  posts: MarketingPost[];
  role: UserRole;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => boolean | void;
  onOpenLightbox: (imageUrl: string) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  posts,
  role,
  onSelectProduct,
  onAddToCart,
  onOpenLightbox
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price_low' | 'price_high' | 'rating'>('featured');
  const [addedId, setAddedId] = useState<string | null>(null);

  const categories: { id: ProductCategory | 'all'; label: string }[] = [
    { id: 'all', label: `All Products (${products.length})` },
    { id: 'purifiers', label: 'RO Purifiers' },
    { id: 'dispensers', label: 'Dispensers' },
    { id: 'pumps', label: 'Booster Pumps' },
    { id: 'filters', label: 'Filters & RO' },
    { id: 'spares', label: 'Spares & Valves' }
  ];
  categories.slice(1).forEach(category => {
    category.label += ` (${products.filter(product => product.category === category.id).length})`;
  });

  let filtered = products.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sort
  if (sortBy === 'price_low') {
    filtered.sort((a, b) => (role === 'dealer' ? a.wholesalePrice - b.wholesalePrice : a.retailPrice - b.retailPrice));
  } else if (sortBy === 'price_high') {
    filtered.sort((a, b) => (role === 'dealer' ? b.wholesalePrice - a.wholesalePrice : b.retailPrice - a.retailPrice));
  } else if (sortBy === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  }

  const handleAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (onAddToCart(product) === false) return;
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1000);
  };

  return (
    <div className="space-y-4 pb-20">
      {posts.length > 0 && <section aria-label="Califnco updates" className="flex gap-3 overflow-x-auto">
        {posts.map(post => <article key={post.id} className="flex min-w-[260px] max-w-[300px] items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <img src={post.image} alt={post.title} className="h-16 w-16 shrink-0 rounded-xl bg-slate-100 object-cover" />
          <div className="min-w-0"><h3 className="truncate text-xs font-bold">{post.title}</h3><p className="line-clamp-2 text-[10px] text-slate-500">{post.caption}</p>{post.hashtags.length > 0 && <p className="truncate text-[9px] text-sky-600">{post.hashtags.map(tag => `#${tag}`).join(' ')}</p>}</div>
        </article>)}
      </section>}
      {/* Dealer Wholesale Notice Banner */}
      {role === 'dealer' && (
        <div className="bg-purple-600 text-white p-3.5 rounded-2xl shadow-md flex items-center justify-between text-xs">
          <div>
            <p className="font-extrabold flex items-center space-x-1.5">
              <span>B2B Wholesale Catalog Active</span>
            </p>
            <p className="text-[11px] text-purple-100">
              Dealer pricing and minimum order quantities are shown for each live product.
            </p>
          </div>
          <span className="px-2.5 py-1 bg-white/20 rounded-full font-bold text-[10px] uppercase">
            Dealer Tier
          </span>
        </div>
      )}

      {/* Search & Sort Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search water purifiers, pumps, filters..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="featured">Featured</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
          <option value="rating">Top Rated</option>
        </select>
      </div>

      {/* Categories Scrollable Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Products Grid (2 columns on mobile) */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(product => {
          const displayPrice = role === 'dealer' ? product.wholesalePrice : product.retailPrice;
          return (
            <div
              key={product.id}
              onClick={() => onSelectProduct(product)}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
            >
              <div>
                {/* Image + Lightbox Trigger Button */}
                <div className="relative h-36 bg-slate-100 dark:bg-slate-900 overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Zoom Lightbox Pill Button (+5 bonus pts) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLightbox(product.image);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                    title="Zoom Image Lightbox"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {/* Category Pill */}
                  <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-900/70 text-white backdrop-blur-sm">
                    {product.category}
                  </span>
                </div>

                {/* Details */}
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center space-x-1 text-[11px] text-amber-500 font-semibold">
                    <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                    <span>{product.rating}</span>
                    <span className="text-slate-400 text-[10px]">({product.reviewsCount})</span>
                  </div>

                  <h4 className="font-bold text-slate-900 dark:text-white text-xs line-clamp-2 leading-snug">
                    {product.name}
                  </h4>
                  {product.caption && <p className="line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">{product.caption}</p>}

                  {/* Price */}
                  <div className="pt-1">
                    <div className="flex items-baseline">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        ₹{displayPrice.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {role === 'dealer' && (
                      <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-0.5">
                        MOQ: {product.moq} pcs
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Add to Cart Footer */}
              <div className="p-2.5 pt-0">
                <button
                  onClick={(e) => handleAdd(e, product)}
                  disabled={!product.inStock || product.stock <= 0}
                  className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    addedId === product.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 hover:bg-sky-600 hover:text-white'
                  }`}
                >
                  {!product.inStock || product.stock <= 0 ? <span>Out of stock</span> : addedId === product.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Added</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{role === 'dealer' ? `Bulk Order (${product.moq})` : 'Add to Cart'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-xs text-slate-500">No products are available for this search yet.</p>}
    </div>
  );
};
