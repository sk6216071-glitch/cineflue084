'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ListPlus, FolderPlus, Plus, Sparkles, Layers, Share2, Trash2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { MOCK_TITLES } from '@/lib/mockData';
import { getImageURL } from '@/lib/tmdb';

export default function CustomListsPage() {
  const { customLists, createCustomList, deleteCustomList } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createCustomList(title.trim(), description.trim(), true);
    setTitle('');
    setDescription('');
    setIsCreating(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Layers className="w-4 h-4" /> Curated Collections
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">Custom Lists</h1>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Create, curate, and share themed movie and TV collections with the CineFuel community.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          Create New List
        </button>
      </div>

      {/* Create Modal/Form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="bg-[#0f121a] border border-amber-500/40 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-amber-400" /> Create Custom Collection
            </h3>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">List Title</label>
              <input
                type="text"
                placeholder="e.g. 90s Cyberpunk Classics, Indian Cinema Gems"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Description</label>
              <input
                type="text"
                placeholder="What is this collection about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors"
            >
              Save List
            </button>
          </div>
        </form>
      )}

      {/* Lists Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {customLists.map((list) => {
          // Preview posters
          const previewPosters = list.itemIds.slice(0, 4).map((id) => {
            const mock = Object.values(MOCK_TITLES).find((t) => t.id === id);
            return mock ? getImageURL(mock.poster_path, 'w300') : '/placeholder-poster.svg';
          });

          return (
            <div
              key={list.id}
              className="bg-[#0f121a] border border-zinc-800 rounded-2xl overflow-hidden hover:border-amber-400/40 hover:shadow-2xl transition-all flex flex-col justify-between group"
            >
              {/* Poster 2x2 Collage */}
              <Link href={`/lists/${list.id}`} className="block relative aspect-[16/9] w-full bg-zinc-950 overflow-hidden border-b border-zinc-800">
                {previewPosters.length > 0 ? (
                  <div className="grid grid-cols-4 h-full w-full">
                    {previewPosters.map((src, i) => (
                      <div key={i} className="relative h-full w-full overflow-hidden">
                        <Image
                          src={src}
                          alt="Poster preview"
                          fill
                          sizes="150px"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-zinc-600 text-xs">
                    No posters added yet
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <span className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded-md bg-black/80 text-[11px] font-bold text-amber-400 border border-white/10">
                  {list.itemIds.length} titles
                </span>
              </Link>

              {/* Body */}
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <Link
                    href={`/lists/${list.id}`}
                    className="text-base font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1"
                  >
                    {list.title}
                  </Link>
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {list.description || 'A custom curated cinema collection.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60 text-xs text-zinc-500">
                  <span>Updated {new Date(list.updatedAt).toLocaleDateString()}</span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteCustomList(list.id)}
                      className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                      title="Delete List"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      href={`/lists/${list.id}`}
                      className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
