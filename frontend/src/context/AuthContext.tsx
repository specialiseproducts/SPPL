import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  isAuthenticated as hasStoredToken,
  login as loginRequest,
  logout as clearSession,
  removeToken,
} from '../services/authService';

export type AuthRole = 'Developer' | 'Admin' | 'User' | 'Accountant' | 'None';

export interface AuthUser {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  name: string;
  role: AuthRole;
  officialEmail?: string;
  designation?: string;
  profilePhoto?: string;
  corporateId?: string;
  phoneNumber?: string;
  personalEmail?: string;
  emergencyContact?: string;
  dateOfJoining?: string;
  dateOfExit?: string;
  dateOfBirth?: string;
  gender?: string;
  location?: string;
  aadharNo?: string;
  panNo?: string;
  passportNo?: string;
  uanNumber?: string;
  mediClaimNo?: string;
  biometricCode?: string;
  biometricPassword?: string;
  accountNo?: string;
  bankName?: string;
  ifsc?: string;
  address?: string;
  permanentAddress?: string;
  documentsUrl?: string;
  pastExperienceUrl?: string;
  password?: string;
}

interface AccessControl {
  globalRole?: string;
  moduleOverrides?: Record<string, string>;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessControl: AccessControl;
  token: string;
  isAuthenticated: boolean;
  loading: boolean;
  login: (employeeCode: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toRole(role: string): AuthRole {
  const value = String(role || '').trim();
  if (value === 'Developer' || value === 'Admin' || value === 'User' || value === 'Accountant' || value === 'None') {
    return value;
  }
  return 'User';
}

function mapAuthUser(rawUser: any, accessControl: AccessControl): AuthUser {
  const firstName = String(rawUser?.firstName || '').trim();
  const lastName = String(rawUser?.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim() || String(rawUser?.name || '').trim() || rawUser?.employeeCode || 'User';
  const employeeCode = String(rawUser?.employeeCode || rawUser?.id || '').trim();
  const role = toRole(accessControl?.globalRole || rawUser?.role || 'User');

  return {
    id: employeeCode,
    employeeCode,
    firstName,
    lastName,
    name: fullName,
    role,
    officialEmail: rawUser?.officialEmail || '',
    designation: rawUser?.designation || '',
    profilePhoto: rawUser?.profilePhoto || '',
    corporateId: rawUser?.corporateId || '',
    phoneNumber: rawUser?.phoneNumber || '',
    personalEmail: rawUser?.personalEmail || '',
    emergencyContact: rawUser?.emergencyContact || '',
    dateOfJoining: rawUser?.dateOfJoining || '',
    dateOfExit: rawUser?.dateOfExit || '',
    dateOfBirth: rawUser?.dateOfBirth || '',
    gender: rawUser?.gender || '',
    location: rawUser?.location || '',
    aadharNo: rawUser?.aadharNo || '',
    panNo: rawUser?.panNo || '',
    passportNo: rawUser?.passportNo || '',
    uanNumber: rawUser?.uanNumber || '',
    mediClaimNo: rawUser?.mediClaimNo || '',
    biometricCode: rawUser?.biometricCode || '',
    biometricPassword: rawUser?.biometricPassword || '',
    accountNo: rawUser?.accountNo || '',
    bankName: rawUser?.bankName || '',
    ifsc: rawUser?.ifsc || '',
    address: rawUser?.address || '',
    permanentAddress: rawUser?.permanentAddress || '',
    documentsUrl: rawUser?.documentsUrl || '',
    pastExperienceUrl: rawUser?.pastExperienceUrl || '',
    password: rawUser?.password || '',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessControl, setAccessControl] = useState<AccessControl>({});
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!hasStoredToken()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const session = await getCurrentUser();
        if (!active) return;
        const ac = session.accessControl || {};
        setAccessControl(ac);
        setUser(mapAuthUser(session.user, ac));
        setToken(session.token || '');
      } catch {
        removeToken();
        if (!active) return;
        setUser(null);
        setAccessControl({});
        setToken('');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setUser(null);
      setAccessControl({});
      setToken('');
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (!token) return;
    let timeoutId: number | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || ''));
      const expMs = Number(payload?.exp || 0) * 1000;
      const delay = expMs - Date.now();
      if (Number.isFinite(delay) && delay > 0) {
        timeoutId = window.setTimeout(() => {
          clearSession();
          setUser(null);
          setAccessControl({});
          setToken('');
        }, delay);
      } else {
        clearSession();
        setUser(null);
        setAccessControl({});
        setToken('');
      }
    } catch {
      clearSession();
      setUser(null);
      setAccessControl({});
      setToken('');
    }
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [token]);

  const login = async (employeeCode: string, password: string) => {
    const result = await loginRequest(employeeCode, password);
    const ac = result.accessControl || {};
    setAccessControl(ac);
    setUser(mapAuthUser(result.user, ac));
    setToken(result.token || '');
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setAccessControl({});
    setToken('');
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessControl,
      token,
      isAuthenticated: Boolean(user && token),
      loading,
      login,
      logout,
    }),
    [user, accessControl, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

