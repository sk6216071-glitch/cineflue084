'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, Share2, ArrowLeft, Trash2, Check, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { TitleDetails } from '@/types';
import { MOCK_TITLES } from '@/lib/mockData';
import { getTitleDetails } from '@/lib/tmdb';
import MovieCard from '@/components/MovieCard';

export default function CustomListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;
  const { customLists, removeTitleFromCustomList, deleteCustomList } = useAuth();

  const list = customLists.find((l) => l.id === listId);
  const [items, setItems] = useState<TitleDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadListItems() {
      if (!list) return;
      setLoading(true);
      const fetched: TitleDetails[] = [];

      for (const id of list.itemIds) {
        // Try finding in mock titles
        const mock = Object.values(MOCK_TITLES).find((t) => t.id === id);
        if (mock) {
          fetched.push(mock);
        } else {
          const res = await getTitleDetails('movie', id);
          if (res) fetched.push(res);
        }
      }

      if (!isCancelled) {
        setItems(fetched);
        setLoading(false);
      }
    }

    loadListItems();

    return () => {
      isCancelled = true;
    };
  }, [list]);

  if (!list) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">List Not Found</h2>
        <p className="text-xs text-zinc-400">This custom collection may have been removed.</p>
        <Link href="/lists" className="text-amber-400 text-xs font-semibold hover:underline">
          ← Back to Custom Lists
        </Link>
      </div>
    );
  }

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this custom list?')) {
      deleteCustomList(list.id);
      router.push('/lists');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <Link
        href="/lists"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white font-semibold transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Lists
      </Link>

      {/* Header Banner */}
      <div className="bg-[#0f121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
              <Layers className="w-3 h-3" /> CineFuel Collection
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white">{list.title}</h1>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
              {list.description || 'Curated movie and television collection.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              {copied ? 'Link Copied' : 'Share List'}
            </button>

            <button
              onClick={handleDelete}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition-colors"
              title="Delete List"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-500 pt-2 border-t border-zinc-800/60">
          <span>{items.length} titles in this list</span>
          <span>•</span>
          <span>Updated {new Date(list.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Titles Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Titles in Collection</h2>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {items.map((item) => (
              <div key={item.id} className="relative group">
                <MovieCard item={item} />
                <button
                  onClick={() => removeTitleFromCustomList(list.id, item.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/80 hover:bg-rose-600 text-zinc-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-md"
                  title="Remove from this list"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2">
            <p className="text-sm font-semibold text-zinc-300">No titles in this list yet.</p>
            <p className="text-xs text-zinc-500">
              Browse movies and TV shows, then click &quot;Save to List&quot; to add them here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
