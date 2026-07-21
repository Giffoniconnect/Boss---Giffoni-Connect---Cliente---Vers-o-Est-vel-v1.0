import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

function safeSessionGet(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(key);
  } catch (err) {
    console.warn('[AuthContext] sessionStorage indisponível:', err);
    return null;
  }
}

function safeSessionSet(key: string, value: string) {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
    }
  } catch (err) {
    console.warn('[AuthContext] não foi possível gravar sessionStorage:', err);
  }
}

function safeSessionRemove(key: string) {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('[AuthContext] não foi possível limpar sessionStorage:', err);
  }
}

export type UserRole = 'boss_admin' | 'client' | 'partner' | 'outsourced';

interface UserProfile {
  email: string;
  role: UserRole;
  clientId?: string;
  clientSlug?: string;
  name?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isClient: boolean;
  errorMsg: string | null;
  setErrorMsg: (msg: string | null) => void;
  logout: () => Promise<void>;
  loginWithGoogle: (role?: UserRole) => Promise<void>;
  googleAccessToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    return safeSessionGet('google_access_token');
  });

  const resolveUserProfile = async (firebaseUser: FirebaseUser, requestedRole?: UserRole): Promise<UserProfile | null> => {
    try {
      // 1. Check by UID directly
      const docRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }

      const email = firebaseUser.email;
      if (!email) return null;

      // 2. Check by Email if no UID profile exists (Case-insensitive matching)
      let foundData: any = null;
      
      const q1 = query(collection(db, 'users'), where('email', '==', email));
      const snap1 = await getDocs(q1);
      
      if (!snap1.empty) {
        foundData = snap1.docs[0].data();
      } else {
        const q2 = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          foundData = snap2.docs[0].data();
        }
      }

      if (foundData) {
        const mergedProfile = {
          ...foundData,
          uid: firebaseUser.uid,
          updatedAt: serverTimestamp()
        };
        if (email === 'direito.rgr@gmail.com') {
          mergedProfile.role = 'boss_admin';
        }
        await setDoc(docRef, mergedProfile);
        return mergedProfile as UserProfile;
      }

      // 3. New User / Bootstrap admin
      if (requestedRole || email === 'direito.rgr@gmail.com') {
        const newProfile: UserProfile = {
          email: email,
          role: requestedRole || (email === 'direito.rgr@gmail.com' ? 'boss_admin' : 'client'),
        };
        await setDoc(docRef, {
          ...newProfile,
          createdAt: serverTimestamp()
        });
        return newProfile;
      }

      throw new Error("Seu e-mail não está cadastrado neste portal fático. Solicite acesso ao administrador BOSS.");
    } catch (e: any) {
      console.error("Erro ao resolver perfil:", e);
      throw e;
    }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setErrorMsg(null);
      if (firebaseUser) {
        try {
          // Synchronize session token with backend Express cookie session
          const idToken = await firebaseUser.getIdToken();
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });

          const matchedProfile = await resolveUserProfile(firebaseUser);
          setProfile(matchedProfile);
        } catch (error: any) {
          setErrorMsg(error.message || "Erro de permissão no Firebase");
          setProfile(null);
        }
      } else {
        setProfile(null);
        // Clear backend session cookie
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch (err) {
          console.warn('[AuthContext] Falha ao limpar sessão no backend:', err);
        }
      }
      setLoading(false);
    });
  }, []);

  const loginWithGoogle = async (role?: UserRole) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'consent select_account' });
      provider.addScope('https://www.googleapis.com/auth/drive');
      provider.addScope('https://www.googleapis.com/auth/documents');
      provider.addScope('https://www.googleapis.com/auth/gmail.send');
      provider.addScope('https://www.googleapis.com/auth/gmail.compose');
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      provider.addScope('https://www.googleapis.com/auth/contacts');
      provider.addScope('https://www.googleapis.com/auth/meetings.space.created');
      
      const result = await signInWithPopup(auth, provider);
      const newUser = result.user;

      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        setGoogleAccessToken(token);
        safeSessionSet('google_access_token', token);
        try {
          localStorage.setItem('google_access_token', token);
          localStorage.setItem('oauth_google_access_token', token);
          localStorage.setItem('portal_boss_google_accessToken', token);
        } catch (e) {
          console.warn("localStorage write error:", e);
        }
      }

      const matchedProfile = await resolveUserProfile(newUser, role);
      if (!matchedProfile) {
        throw new Error("Não foi possível carregar seu perfil no sistema.");
      }
      setProfile(matchedProfile);
    } catch (error: any) {
      console.error("Login falhou:", error);
      let friendlyMessage = error.message || "Falha na autenticação via Google";
      const isPopupClosed = 
        error.code === 'auth/popup-closed-by-user' ||
        String(error).includes('popup-closed-by-user') ||
        (error.message && String(error.message).includes('popup-closed-by-user'));

      const isUnauthorizedDomain = 
        error.code === 'auth/unauthorized-domain' ||
        String(error).includes('unauthorized-domain') ||
        (error.message && String(error.message).includes('unauthorized-domain'));

      if (isPopupClosed) {
        friendlyMessage = "A janela de login do Google foi fechada antes de concluir a autenticação. Por favor, tente novamente clicando no botão para entrar.";
        setErrorMsg(friendlyMessage);
        // Do NOT sign out or clear profile if the user was already authenticated and just cancelled a re-authentication/renewal flow!
        if (user && profile) {
          return;
        }
      } else if (isUnauthorizedDomain) {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : 'seu-dominio';
        friendlyMessage = `Este domínio (${hostname}) não está autorizado para autenticação no console do seu projeto Firebase (planar-granite-495814-r8).

Para corrigir este erro de permissão:
1. Acesse o console do Firebase em: https://console.firebase.google.com/project/planar-granite-495814-r8/authentication/settings
2. Vá até a aba "Domínios autorizados" (Authorized domains).
3. Clique em "Adicionar domínio" e insira os seguintes domínios:
   - ${hostname}
   - ais-dev-c2bi4hli5khs2zujk7j5cs-599536317399.us-east1.run.app
   - ais-pre-c2bi4hli5khs2zujk7j5cs-599536317399.us-east1.run.app
   - localhost
4. Após salvar no Firebase, recarregue esta página e tente fazer login novamente.`;
        setErrorMsg(friendlyMessage);
      } else {
        setErrorMsg(friendlyMessage);
      }
      // Clean up auth session if it failed profile check or was not already signed in
      await signOut(auth);
      setProfile(null);
      setUser(null);
      setGoogleAccessToken(null);
      safeSessionRemove('google_access_token');
      try {
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('oauth_google_access_token');
        localStorage.removeItem('portal_boss_google_accessToken');
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setErrorMsg(null);
    setProfile(null);
    setGoogleAccessToken(null);
    safeSessionRemove('google_access_token');
    await signOut(auth);
  };

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'boss_admin' || user?.email === 'direito.rgr@gmail.com',
    isClient: profile?.role === 'client',
    errorMsg,
    setErrorMsg,
    logout,
    loginWithGoogle,
    googleAccessToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
