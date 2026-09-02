'use client';

import React, { useState } from 'react';
import { X, Plus, Check, ListPlus, FolderPlus, Sparkles } from 'lucide-react';
import { TitleDetails } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface AddToListModalProps {
  titleDetails: TitleDetails;
  onClose: () => void;
}

export const AddToListModal: React.FC<AddToListModalProps> = ({ titleDetails, onClose }) => {
  const { customLists, createCustomList, addTitleToCustomList, removeTitleFromCustomList, isTitleInCustomList } =
    useAuth();

  const [isCreating, setIsCreating] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListDesc, setNewListDesc] = useState('');

  const handleToggle = (listId: string) => {
    if (isTitleInCustomList(listId, titleDetails.id)) {
      removeTitleFromCustomList(listId, titleDetails.id);
    } else {
      addTitleToCustomList(listId, titleDetails);
    }
  };

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;

    const created = createCustomList(newListTitle.trim(), newListDesc.trim(), true);
    addTitleToCustomList(created.id, titleDetails);

    setNewListTitle('');
    setNewListDesc('');
    setIsCreating(false);
  };

  const titleName = titleDetails.title || titleDetails.name || 'Title';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#0e1117] border border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <ListPlus className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Save &quot;{titleName}&quot; to List</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-sm max-h-[60vh] overflow-y-auto">
          {/* Custom Lists Checklist */}
          {customLists.length > 0 ? (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Your Custom Collections
              </label>
              {customLists.map((list) => {
                const inList = isTitleInCustomList(list.id, titleDetails.id);
                return (
                  <button
                    key={list.id}
                    onClick={() => handleToggle(list.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                      inList
                        ? 'bg-amber-500/10 border-amber-500/40 text-white'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{list.title}</h4>
                      <p className="text-[10px] text-zinc-400 line-clamp-1">{list.description || `${list.itemIds.length} titles`}</p>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        inList
                          ? 'bg-amber-500 border-amber-500 text-black'
                          : 'border-zinc-700 bg-zinc-800 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-zinc-400 text-xs">
              You haven&apos;t created any custom lists yet.
            </div>
          )}

          {/* Create New List Inline */}
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-dashed border-zinc-700 text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Custom List
            </button>
          ) : (
            <form onSubmit={handleCreateList} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FolderPlus className="w-4 h-4 text-amber-400" /> New Collection
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-[11px] text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="List Title (e.g. Best 2024 Sci-Fi)"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Brief description (optional)"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors"
                >
                  Create & Add
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/30">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToListModal;
