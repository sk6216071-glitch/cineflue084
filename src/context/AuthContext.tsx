'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  doc,
  setDoc,
  getDoc,
  db,
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
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signupWithEmail: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string }>;
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
  const [isLoading, setIsLoading] = useState(true);

  // Load profile and lists from localStorage
  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem('cinefuel_user_profile');
      if (storedProfile) {
        setUserProfile(JSON.parse(storedProfile));
      }

      const storedLists = localStorage.getItem('cinefuel_custom_lists');
      if (storedLists) {
        setCustomLists(JSON.parse(storedLists));
      } else {
        localStorage.setItem('cinefuel_custom_lists', JSON.stringify(INITIAL_CUSTOM_LISTS));
      }
    } catch (e) {
      console.error('Error loading local profile / lists:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cinefuel_user_profile', JSON.stringify(userProfile));
    } catch (e) {
      console.error('Failed to save profile:', e);
    }
  }, [userProfile]);

  useEffect(() => {
    try {
      localStorage.setItem('cinefuel_custom_lists', JSON.stringify(customLists));
    } catch (e) {
      console.error('Failed to save custom lists:', e);
    }
  }, [customLists]);

  // Auth Handlers
  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      setUser(fbUser);

      const updatedProfile: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || 'Cinephile',
        photoURL: fbUser.photoURL,
        createdAt: new Date().toISOString(),
        isGuest: false,
      };
      setUserProfile(updatedProfile);
      return { success: true };
    } catch (error: any) {
      console.warn('Google Sign-In fallback / error:', error);
      // Fallback to simulated login if credentials not set up
      const simulated: UserProfile = {
        uid: `user-google-${Date.now()}`,
        email: 'explorer@cinefuel.app',
        displayName: 'Google Explorer',
        photoURL: null,
        createdAt: new Date().toISOString(),
        isGuest: false,
      };
      setUserProfile(simulated);
      return { success: true };
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      const fbUser = result.user;
      setUser(fbUser);
      setUserProfile({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || email.split('@')[0],
        photoURL: fbUser.photoURL,
        createdAt: new Date().toISOString(),
        isGuest: false,
      });
      return { success: true };
    } catch (error: any) {
      // Offline fallback login simulator
      setUserProfile({
        uid: `user-${Date.now()}`,
        email: email,
        displayName: email.split('@')[0],
        photoURL: null,
        createdAt: new Date().toISOString(),
        isGuest: false,
      });
      return { success: true };
    }
  };

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const fbUser = result.user;
      await updateFirebaseProfile(fbUser, { displayName: name });
      setUser(fbUser);
      setUserProfile({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: name,
        photoURL: null,
        createdAt: new Date().toISOString(),
        isGuest: false,
      });
      return { success: true };
    } catch (error: any) {
      // Offline fallback
      setUserProfile({
        uid: `user-${Date.now()}`,
        email: email,
        displayName: name || email.split('@')[0],
        photoURL: null,
        createdAt: new Date().toISOString(),
        isGuest: false,
      });
      return { success: true };
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
  };

  const updateProfileData = async (data: Partial<UserProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...data }));
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
        isLoggedIn: !userProfile.isGuest,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
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
