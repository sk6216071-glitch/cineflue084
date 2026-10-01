'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
} from '@/lib/firebase';
import { UserProfile, CustomList, WatchlistItem, TitleDetails } from '@/types';

const INITIAL_GUEST_PROFILE: UserProfile = {
  uid: 'guest-user-default',
  email: 'cinephile@cinefuel.app',
  displayName: 'Cinema Explorer',
  photoURL: null,
  bio: 'Cinema lover exploring hidden gems, sci-fi masterpieces, and Indian blockbusters.',
  favoriteGenres: ['Sci-Fi', 'Drama', 'Action', 'Thriller'],
  createdAt: '2024-01-01T00:00:00Z',
  isGuest: true,
};

const INITIAL_CUSTOM_LISTS: CustomList[] = [
  {
    id: 'list-nolan-mindbenders',
    userId: 'guest-user-default',
    title: 'Mind-Bending Sci-Fi & Epics',
    description: 'A collection of reality-bending, visually stunning cinematic experiences.',
    isPublic: true,
    itemIds: [872585, 157336, 693134, 27205],
    items: [],
    createdAt: '2024-01-10T12:00:00Z',
    updatedAt: '2024-02-15T18:30:00Z',
  },
  {
    id: 'list-prestige-tv',
    userId: 'guest-user-default',
    title: 'Prestige Television Essentials',
    description: 'The golden age of television drama, crime thrillers, and mystery series.',
    isPublic: true,
    itemIds: [1396, 114472],
    items: [],
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
];

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile;
  isLoading: boolean;
  isLoggedIn: boolean;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string; notFound?: boolean }>;
  signupWithEmail: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string; alreadyExists?: boolean }>;
  fastLogin: (email: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
  customLists: CustomList[];
  createCustomList: (title: string, description: string, isPublic?: boolean) => CustomList;
  deleteCustomList: (listId: string) => void;
  addTitleToCustomList: (listId: string, titleItem: TitleDetails) => void;
  removeTitleFromCustomList: (listId: string, titleId: number) => void;
  isTitleInCustomList: (listId: string, titleId: number) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_GUEST_PROFILE);
  const [customLists, setCustomLists] = useState<CustomList[]>(INITIAL_CUSTOM_LISTS);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Load profile and lists from localStorage safely on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedProfile = localStorage.getItem('cinefuel_user_profile');
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          if (parsed && parsed.email && !parsed.isGuest && parsed.uid !== 'guest-user-default') {
            setUserProfile(parsed);
            // Non-blocking background sync with server
            fetch(`/api/users/auth?email=${encodeURIComponent(parsed.email)}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data?.success && data.user) {
                  setUserProfile((prev) => {
                    const merged = { ...prev, ...data.user, isGuest: false };
                    try {
                      localStorage.setItem('cinefuel_user_profile', JSON.stringify(merged));
                    } catch (e) {}
                    return merged;
                  });
                }
              })
              .catch(() => {});
          }
        }

        const storedLists = localStorage.getItem('cinefuel_custom_lists');
        if (storedLists) {
          const parsedLists = JSON.parse(storedLists);
          if (Array.isArray(parsedLists) && parsedLists.length > 0) {
            setCustomLists(parsedLists);
          }
        } else {
          localStorage.setItem('cinefuel_custom_lists', JSON.stringify(INITIAL_CUSTOM_LISTS));
        }
      }
    } catch (e) {
      console.error('Error loading stored profile / lists:', e);
    } finally {
      setIsInitialized(true);
      setIsLoading(false);
    }
  }, []);

  // 2. Save profile changes to localStorage ONLY after initialization (prevents mount wipe)
  useEffect(() => {
    if (!isInitialized) return;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_user_profile', JSON.stringify(userProfile));
      }
    } catch (e) {
      console.error('Failed to save profile to localStorage:', e);
    }
  }, [userProfile, isInitialized]);

  // 3. Save custom lists changes to localStorage ONLY after initialization
  useEffect(() => {
    if (!isInitialized) return;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_custom_lists', JSON.stringify(customLists));
      }
    } catch (e) {
      console.error('Failed to save custom lists:', e);
    }
  }, [customLists, isInitialized]);

  // Sync user profile to server DB
  const syncUserToServer = async (profile: UserProfile, provider = 'email_password') => {
    if (profile.isGuest || profile.uid === 'guest-user-default' || !profile.email) return;
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: profile.uid,
          email: profile.email,
          displayName: profile.displayName || profile.email.split('@')[0],
          photoURL: profile.photoURL,
          bio: profile.bio,
          favoriteGenres: profile.favoriteGenres,
          provider,
        }),
      });
    } catch (e) {
      console.warn('Failed to sync user to server:', e);
    }
  };

  // Auth Handlers
  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      setUser(fbUser);

      // Sync to backend DB
      const res = await fetch('/api/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'google_sync',
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Cinephile',
          photoURL: fbUser.photoURL,
        }),
      });
      const data = await res.json();

      const updatedProfile: UserProfile = {
        uid: data.user?.uid || fbUser.uid,
        email: data.user?.email || fbUser.email,
        displayName: data.user?.displayName || fbUser.displayName || 'Cinephile',
        photoURL: data.user?.photoURL || fbUser.photoURL,
        bio: data.user?.bio || '',
        favoriteGenres: data.user?.favoriteGenres || [],
        createdAt: data.user?.createdAt || new Date().toISOString(),
        isGuest: false,
      };

      setUserProfile(updatedProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_user_profile', JSON.stringify(updatedProfile));
      }
      return { success: true };
    } catch (error: any) {
      console.warn('Google Sign-In note:', error?.message || error);
      return {
        success: false,
        error:
          'Google Sign-In is unavailable or blocked in this browser (e.g. Brave Shields / Adblock). Please sign in with your Email and Password below (or Quick Sign-In).',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: email.trim(),
          password: pass,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Failed to sign in. Please check your credentials.',
          notFound: data.notFound || false,
        };
      }

      const profile: UserProfile = {
        uid: data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName || email.split('@')[0],
        photoURL: data.user.photoURL || null,
        bio: data.user.bio || '',
        favoriteGenres: data.user.favoriteGenres || [],
        createdAt: data.user.createdAt || new Date().toISOString(),
        isGuest: false,
      };

      setUserProfile(profile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_user_profile', JSON.stringify(profile));
      }
      return { success: true };
    } catch (error: any) {
      console.warn('loginWithEmail network fallback:', error);
      const fallbackProfile: UserProfile = {
        uid: `usr_${Date.now()}`,
        email: email.trim(),
        displayName: email.split('@')[0],
        photoURL: null,
        createdAt: new Date().toISOString(),
        isGuest: false,
      };
      setUserProfile(fallbackProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_user_profile', JSON.stringify(fallbackProfile));
      }
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          email: email.trim(),
          password: pass,
          displayName: name.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Failed to create account.',
          alreadyExists: data.alreadyExists || false,
        };
      }

      const profile: UserProfile = {
        uid: data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName || name.trim(),
        photoURL: data.user.photoURL || null,
        bio: data.user.bio || '',
        favoriteGenres: data.user.favoriteGenres || [],
        createdAt: data.user.createdAt || new Date().toISOString(),
        isGuest: false,
      };

      setUserProfile(profile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_user_profile', JSON.stringify(profile));
      }
      return { success: true };
    } catch (error: any) {
      console.warn('signupWithEmail fallback:', error);
      const fallbackProfile: UserProfile = {
        uid: `usr_${Date.now()}`,
        email: email.trim(),
        displayName: name.trim() || email.split('@')[0],
        photoURL: null,
        createdAt: new Date().toISOString(),
        isGuest: false,
      };
      setUserProfile(fallbackProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_user_profile', JSON.stringify(fallbackProfile));
      }
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const fastLogin = async (email: string, name?: string) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fast_login',
          email: email.trim(),
          displayName: (name || '').trim(),
        }),
      });

      const data = await res.json();

      if (data.success && data.user) {
        const profile: UserProfile = {
          uid: data.user.uid,
          email: data.user.email,
          displayName: data.user.displayName || email.split('@')[0],
          photoURL: data.user.photoURL || null,
          bio: data.user.bio || '',
          favoriteGenres: data.user.favoriteGenres || [],
          createdAt: data.user.createdAt || new Date().toISOString(),
          isGuest: false,
        };

        setUserProfile(profile);
        if (typeof window !== 'undefined') {
          localStorage.setItem('cinefuel_user_profile', JSON.stringify(profile));
        }
        return { success: true };
      }
      return { success: false, error: data.error || 'Fast login failed.' };
    } catch (err: any) {
      const fallbackProfile: UserProfile = {
        uid: `usr_${Date.now()}`,
        email: email.trim(),
        displayName: name?.trim() || email.split('@')[0],
        photoURL: null,
        createdAt: new Date().toISOString(),
        isGuest: false,
      };
      setUserProfile(fallbackProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_user_profile', JSON.stringify(fallbackProfile));
      }
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignore
    }
    setUser(null);
    setUserProfile(INITIAL_GUEST_PROFILE);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cinefuel_user_profile');
    }
  };

  const updateProfileData = async (data: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const updated = { ...prev, ...data };
      if (typeof window !== 'undefined') {
        localStorage.setItem('cinefuel_user_profile', JSON.stringify(updated));
      }
      syncUserToServer(updated);
      return updated;
    });
  };

  // Custom List Operations
  const createCustomList = (title: string, description: string, isPublic = true): CustomList => {
    const newList: CustomList = {
      id: `list-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: userProfile.uid,
      title: title.trim(),
      description: description.trim(),
      isPublic,
      itemIds: [],
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCustomLists((prev) => [newList, ...prev]);
    return newList;
  };

  const deleteCustomList = (listId: string) => {
    setCustomLists((prev) => prev.filter((l) => l.id !== listId));
  };

  const addTitleToCustomList = (listId: string, titleItem: TitleDetails) => {
    setCustomLists((prev) =>
      prev.map((list) => {
        if (list.id === listId) {
          if (list.itemIds.includes(titleItem.id)) return list;
          return {
            ...list,
            itemIds: [titleItem.id, ...list.itemIds],
            updatedAt: new Date().toISOString(),
          };
        }
        return list;
      })
    );
  };

  const removeTitleFromCustomList = (listId: string, titleId: number) => {
    setCustomLists((prev) =>
      prev.map((list) => {
        if (list.id === listId) {
          return {
            ...list,
            itemIds: list.itemIds.filter((id) => id !== titleId),
            updatedAt: new Date().toISOString(),
          };
        }
        return list;
      })
    );
  };

  const isTitleInCustomList = (listId: string, titleId: number) => {
    const target = customLists.find((l) => l.id === listId);
    return target ? target.itemIds.includes(titleId) : false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isLoading,
        isLoggedIn: !userProfile.isGuest && userProfile.uid !== 'guest-user-default',
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        fastLogin,
        logout,
        updateProfileData,
        customLists,
        createCustomList,
        deleteCustomList,
        addTitleToCustomList,
        removeTitleFromCustomList,
        isTitleInCustomList,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
