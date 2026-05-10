# ⚛️ Mastering Custom Hooks in React + TypeScript
## Volume 2: Intermediate → Advanced Patterns

---

# 11. Debounce and Throttle Hooks

## 11.1 Mental Model

> **Debounce**: "Wait until you stop." Like an elevator door — it waits for the last person before closing.  
> **Throttle**: "Execute at most once per interval." Like a rate limiter — allows bursts but enforces a ceiling.

## 11.2 useDebounce

```typescript
// hooks/useDebounce.ts

// Simple value debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Callback debounce (more versatile)
function useDebouncedCallback<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  options: { leading?: boolean; maxWait?: number } = {}
): [T, { cancel: () => void; flush: () => void; isPending: boolean }] {
  const { leading = false, maxWait } = options;

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallTimeRef = useRef<number | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const [isPending, setIsPending] = useState(false);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
    lastArgsRef.current = null;
    setIsPending(false);
  }, []);

  const flush = useCallback(() => {
    if (lastArgsRef.current) {
      fnRef.current(...lastArgsRef.current);
      cancel();
    }
  }, [cancel]);

  const debounced = useCallback((...args: Parameters<T>) => {
    lastArgsRef.current = args;
    lastCallTimeRef.current = Date.now();

    if (leading && !timerRef.current) {
      fnRef.current(...args);
    }

    setIsPending(true);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (!leading) {
        fnRef.current(...(lastArgsRef.current ?? args));
      }
      timerRef.current = null;
      lastArgsRef.current = null;
      setIsPending(false);
    }, delay);

    // maxWait: ensure function fires at least every maxWait ms
    if (maxWait && !maxWaitTimerRef.current) {
      maxWaitTimerRef.current = setTimeout(() => {
        if (lastArgsRef.current) {
          fnRef.current(...lastArgsRef.current);
        }
        cancel();
      }, maxWait);
    }
  }, [delay, leading, maxWait, cancel]) as T;

  // Cleanup on unmount
  useEffect(() => cancel, [cancel]);

  return [debounced, { cancel, flush, isPending }];
}
```

## 11.3 useThrottle

```typescript
// hooks/useThrottle.ts

function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdatedRef = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdatedRef.current;

    if (timeSinceLastUpdate >= interval) {
      lastUpdatedRef.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastUpdatedRef.current = Date.now();
        setThrottledValue(value);
      }, interval - timeSinceLastUpdate);

      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}

function useThrottledCallback<T extends (...args: any[]) => any>(
  fn: T,
  interval: number
): T {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const lastCallRef = useRef(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;

    if (timeSinceLastCall >= interval) {
      lastCallRef.current = now;
      return fnRef.current(...args);
    }

    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      lastCallRef.current = Date.now();
      fnRef.current(...args);
    }, interval - timeSinceLastCall);
  }, [interval]) as T;
}
```

## 11.4 Real World: Search with Debounce + Loading State

```typescript
function useSearchWithDebounce<T>(
  fetcher: (query: string) => Promise<T[]>,
  delay = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debouncedQuery = useDebounce(query, delay);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setError(null);

    fetcherRef.current(debouncedQuery)
      .then(data => {
        if (!controller.signal.aborted) {
          setResults(data);
          setIsSearching(false);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err);
          setIsSearching(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  // Track whether we're in the debounce window
  const isDebouncing = query !== debouncedQuery;

  return {
    query,
    setQuery,
    results,
    isLoading: isDebouncing || isSearching,
    error,
    isEmpty: !isDebouncing && !isSearching && results.length === 0 && query.length > 0,
  };
}
```

## 11.5 Common Mistake — Creating New Functions on Every Render

```typescript
// ❌ BAD: onSearch is recreated every render → useDebounce gets new fn every time
function SearchBar() {
  const [query, setQuery] = useState('');
  
  // New function reference every render!
  const [debouncedSearch] = useDebouncedCallback(
    (q: string) => search(q), // Arrow function = new ref
    300
  );
  
  return <input onChange={e => debouncedSearch(e.target.value)} />;
}

// ✅ GOOD: Function is stable
function SearchBar() {
  const [query, setQuery] = useState('');
  
  const handleSearch = useCallback((q: string) => search(q), []);
  const [debouncedSearch] = useDebouncedCallback(handleSearch, 300);
  
  return <input onChange={e => debouncedSearch(e.target.value)} />;
}
```

---

# 12. Form and Validation Hooks

## 12.1 Mental Model

> **Mental Model**: A form hook is a **state machine** for data entry. State flows: `pristine → dirty → validating → valid | invalid → submitting → submitted | failed`. Each field has its own path through this machine.

## 12.2 The Core useField Hook

```typescript
// hooks/forms/useField.ts

type Validator<T> = (value: T) => string | null | Promise<string | null>;

interface FieldState<T> {
  value: T;
  error: string | null;
  isDirty: boolean;
  isTouched: boolean;
  isValidating: boolean;
  isValid: boolean;
}

interface UseFieldOptions<T> {
  initialValue: T;
  validators?: Validator<T>[];
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

function useField<T>({
  initialValue,
  validators = [],
  validateOnChange = false,
  validateOnBlur = true,
}: UseFieldOptions<T>) {
  const [value, setValue] = useState<T>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const validatorsRef = useRef(validators);
  validatorsRef.current = validators;

  const validate = useCallback(async (val: T): Promise<string | null> => {
    setIsValidating(true);
    
    for (const validator of validatorsRef.current) {
      const result = await validator(val);
      if (result) {
        setIsValidating(false);
        setError(result);
        return result;
      }
    }
    
    setIsValidating(false);
    setError(null);
    return null;
  }, []);

  const onChange = useCallback(async (newValue: T) => {
    setValue(newValue);
    setIsDirty(true);
    if (validateOnChange) await validate(newValue);
  }, [validate, validateOnChange]);

  const onBlur = useCallback(async () => {
    setIsTouched(true);
    if (validateOnBlur) await validate(value);
  }, [validate, validateOnBlur, value]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setError(null);
    setIsDirty(false);
    setIsTouched(false);
  }, [initialValue]);

  return {
    value,
    error,
    isTouched,
    isDirty,
    isValidating,
    isValid: !error && !isValidating,
    onChange,
    onBlur,
    validate: () => validate(value),
    reset,
    // Spread onto input elements
    inputProps: {
      value: value as unknown as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange(e.target.value as unknown as T),
      onBlur,
    },
  };
}
```

## 12.3 Production-Grade useForm

```typescript
// hooks/forms/useForm.ts

type FieldValues = Record<string, unknown>;

type FormErrors<T extends FieldValues> = {
  [K in keyof T]?: string;
};

interface UseFormOptions<T extends FieldValues> {
  defaultValues: T;
  validators?: {
    [K in keyof T]?: Validator<T[K]>[];
  };
  onSubmit: (values: T) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

function useForm<T extends FieldValues>({
  defaultValues,
  validators = {},
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(defaultValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validatorsRef = useRef(validators);
  validatorsRef.current = validators;

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // Validate a single field
  const validateField = useCallback(async <K extends keyof T>(
    name: K,
    value: T[K]
  ): Promise<string | null> => {
    const fieldValidators = validatorsRef.current[name] ?? [];
    
    for (const validator of fieldValidators) {
      const error = await validator(value);
      if (error) return error;
    }
    
    return null;
  }, []);

  // Validate all fields
  const validateAll = useCallback(async (): Promise<FormErrors<T>> => {
    const entries = await Promise.all(
      (Object.keys(values) as (keyof T)[]).map(async key => {
        const error = await validateField(key, values[key]);
        return [key, error] as const;
      })
    );

    return Object.fromEntries(entries.filter(([, e]) => e !== null)) as FormErrors<T>;
  }, [values, validateField]);

  // Set a single field value
  const setValue = useCallback(async <K extends keyof T>(
    name: K,
    value: T[K]
  ) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setIsDirty(true);

    if (validateOnChange) {
      const error = await validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error ?? undefined }));
    }
  }, [validateField, validateOnChange]);

  // Touch a field (mark as interacted)
  const touchField = useCallback(async <K extends keyof T>(name: K) => {
    setTouched(prev => ({ ...prev, [name]: true }));

    if (validateOnBlur) {
      const error = await validateField(name, values[name]);
      setErrors(prev => ({ ...prev, [name]: error ?? undefined }));
    }
  }, [validateField, validateOnBlur, values]);

  // Get props for a field input
  const register = useCallback(<K extends keyof T>(name: K) => ({
    value: values[name] as unknown as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValue(name, e.target.value as unknown as T[K]);
    },
    onBlur: () => touchField(name),
    name: String(name),
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${String(name)}-error` : undefined,
  }), [values, errors, setValue, touchField]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      return (async () => {
        const allErrors = await validateAll();
        setErrors(allErrors);
        setTouched(
          Object.fromEntries(Object.keys(values).map(k => [k, true])) as typeof touched
        );

        if (Object.keys(allErrors).length > 0) return;

        setIsSubmitting(true);
        setSubmitError(null);

        try {
          await onSubmitRef.current(values);
          setIsSubmitted(true);
        } catch (err) {
          setSubmitError(err instanceof Error ? err : new Error(String(err)));
        } finally {
          setIsSubmitting(false);
        }
      })();
    },
    [validateAll, values]
  );

  const reset = useCallback(() => {
    setValues(defaultValues);
    setErrors({});
    setTouched({});
    setIsDirty(false);
    setIsSubmitting(false);
    setSubmitError(null);
    setIsSubmitted(false);
  }, [defaultValues]);

  const setFieldError = useCallback(<K extends keyof T>(name: K, error: string) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  const isValid = Object.keys(errors).length === 0;
  const isTouchedAny = Object.values(touched).some(Boolean);

  return {
    values,
    errors,
    touched,
    isDirty,
    isValid,
    isSubmitting,
    isSubmitted,
    submitError,
    // Actions
    setValue,
    touchField,
    register,
    handleSubmit,
    reset,
    setFieldError,
  };
}
```

## 12.4 Composable Validators

```typescript
// hooks/forms/validators.ts — functional, composable validators

const required = (message = 'This field is required') =>
  (value: unknown): string | null => {
    if (value === null || value === undefined || value === '') return message;
    return null;
  };

const minLength = (min: number, message?: string) =>
  (value: string): string | null => {
    if (value.length < min) return message ?? `Must be at least ${min} characters`;
    return null;
  };

const maxLength = (max: number, message?: string) =>
  (value: string): string | null => {
    if (value.length > max) return message ?? `Must be at most ${max} characters`;
    return null;
  };

const pattern = (regex: RegExp, message: string) =>
  (value: string): string | null => {
    if (!regex.test(value)) return message;
    return null;
  };

const email = (message = 'Invalid email address') =>
  pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);

// Async validator
const uniqueEmail = async (value: string): Promise<string | null> => {
  const response = await fetch(`/api/check-email?email=${value}`);
  const { available } = await response.json();
  return available ? null : 'Email already in use';
};

// Compose validators
const composeValidators = <T>(...validators: Validator<T>[]) =>
  async (value: T): Promise<string | null> => {
    for (const validator of validators) {
      const error = await validator(value);
      if (error) return error;
    }
    return null;
  };

// Usage
const form = useForm({
  defaultValues: { email: '', password: '', username: '' },
  validators: {
    email: [required(), email(), uniqueEmail],
    password: [required(), minLength(8), pattern(/[A-Z]/, 'Must contain uppercase')],
    username: [required(), minLength(3), maxLength(20)],
  },
  onSubmit: registerUser,
});
```

## 12.5 Interview Insight — Why Not Just Use react-hook-form?

> In most production apps, **you should use react-hook-form** — it's battle-tested, performant (uncontrolled inputs), and handles all edge cases. Building your own teaches you what's underneath. Understand the tradeoffs:
>
> - **react-hook-form**: Uncontrolled (no re-render per keystroke), schema validation via Zod/Yup/Joi, DevTools, tiny bundle.
> - **Custom hook**: Full control, can add domain-specific behavior (server-side validation, auto-save, field dependencies).
>
> Senior engineers know when to build vs use. Here: use react-hook-form.

---

# 13. Authentication and Permission Hooks

## 13.1 Auth Hook Architecture

```
┌───────────────────────────────────────────────────────────┐
│                      AuthProvider                         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │   AuthContext: { user, session, status, actions }   │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                 │
│   useAuth()  useUser()  usePermissions()  useSession()    │
└───────────────────────────────────────────────────────────┘
```

## 13.2 Full Auth Hook Implementation

```typescript
// types/auth.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  permissions: string[];
  avatar?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

// contexts/AuthContext.tsx
interface AuthContextValue {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem('session');
    if (!stored) {
      setStatus('unauthenticated');
      return;
    }

    const parsedSession: Session = JSON.parse(stored);
    
    if (Date.now() > parsedSession.expiresAt) {
      // Token expired — try refresh
      refreshSessionWithToken(parsedSession.refreshToken).catch(() => {
        setStatus('unauthenticated');
        localStorage.removeItem('session');
      });
    } else {
      // Valid session — load user
      setSession(parsedSession);
      fetchCurrentUser(parsedSession.accessToken)
        .then(user => {
          setUser(user);
          setStatus('authenticated');
        })
        .catch(() => setStatus('unauthenticated'));
    }
  }, []);

  // Auto-refresh before expiry
  useEffect(() => {
    if (!session) return;
    
    const timeUntilExpiry = session.expiresAt - Date.now();
    const refreshAt = timeUntilExpiry - 5 * 60 * 1000; // 5 min before expiry
    
    if (refreshAt <= 0) return;
    
    const timer = setTimeout(() => refreshSessionWithToken(session.refreshToken), refreshAt);
    return () => clearTimeout(timer);
  }, [session]);

  const refreshSessionWithToken = async (refreshToken: string) => {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) throw new Error('Refresh failed');
    
    const newSession: Session = await response.json();
    setSession(newSession);
    localStorage.setItem('session', JSON.stringify(newSession));
  };

  const fetchCurrentUser = async (accessToken: string): Promise<User> => {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  };

  const login = async (credentials: { email: string; password: string }) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message ?? 'Login failed');
    }
    
    const { session: newSession, user: newUser } = await response.json();
    setSession(newSession);
    setUser(newUser);
    setStatus('authenticated');
    localStorage.setItem('session', JSON.stringify(newSession));
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
    } finally {
      setUser(null);
      setSession(null);
      setStatus('unauthenticated');
      localStorage.removeItem('session');
    }
  };

  return (
    <AuthContext.Provider value={{
      user, session, status,
      login, logout,
      refreshSession: () => refreshSessionWithToken(session?.refreshToken ?? ''),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// hooks/useAuth.ts
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function useUser(): User {
  const { user, status } = useAuth();
  if (status === 'loading') throw new Promise(() => {}); // Suspense support
  if (!user) throw new Error('User not authenticated');
  return user;
}
```

## 13.3 Permission and Role Hooks

```typescript
// hooks/usePermissions.ts

type Permission = string; // e.g., 'posts:create', 'users:delete', 'admin:*'

interface UsePermissionsReturn {
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  hasRole: (role: string) => boolean;
  isAdmin: boolean;
}

function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();

  const can = useCallback((permission: Permission): boolean => {
    if (!user) return false;
    
    // Admin wildcard
    if (user.permissions.includes('*')) return true;
    if (user.role === 'admin') return true;
    
    // Exact match
    if (user.permissions.includes(permission)) return true;
    
    // Wildcard match: 'posts:*' matches 'posts:create'
    const [resource] = permission.split(':');
    if (user.permissions.includes(`${resource}:*`)) return true;
    
    return false;
  }, [user]);

  return {
    can,
    canAny: (permissions) => permissions.some(can),
    canAll: (permissions) => permissions.every(can),
    hasRole: (role) => user?.role === role,
    isAdmin: user?.role === 'admin',
  };
}

// Usage with component
function AdminPanel() {
  const { can, isAdmin } = usePermissions();
  
  if (!can('admin:access')) {
    return <Unauthorized />;
  }
  
  return (
    <div>
      <h1>Admin Panel</h1>
      {can('users:delete') && <DangerZone />}
      {isAdmin && <SystemSettings />}
    </div>
  );
}

// Higher-order hook for guarded routes
function useRequirePermission(permission: Permission) {
  const { can } = usePermissions();
  const navigate = useNavigate(); // React Router
  
  useEffect(() => {
    if (!can(permission)) {
      navigate('/unauthorized', { replace: true });
    }
  }, [can, permission, navigate]);
  
  return can(permission);
}
```

---

# 14. Browser API Hooks

## 14.1 useLocalStorage

```typescript
// hooks/browser/useLocalStorage.ts

type StorageSerializer<T> = {
  read: (raw: string) => T;
  write: (value: T) => string;
};

const defaultSerializer: StorageSerializer<unknown> = {
  read: JSON.parse,
  write: JSON.stringify,
};

function useLocalStorage<T>(
  key: string,
  initialValue: T,
  serializer: StorageSerializer<T> = defaultSerializer as StorageSerializer<T>
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Read from localStorage with fallback
  const readStorage = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue; // SSR safety
    
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? serializer.read(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue, serializer]);

  const [storedValue, setStoredValue] = useState<T>(readStorage);

  // Sync with other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== key) return;
      
      if (event.newValue === null) {
        setStoredValue(initialValue);
      } else {
        try {
          setStoredValue(serializer.read(event.newValue));
        } catch {
          setStoredValue(initialValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue, serializer]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const next = typeof value === 'function' ? (value as Function)(prev) : value;
      try {
        window.localStorage.setItem(key, serializer.write(next));
      } catch (error) {
        console.warn(`Error writing localStorage key "${key}":`, error);
      }
      return next;
    });
  }, [key, serializer]);

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
```

## 14.2 useURLSearchParams

```typescript
// hooks/browser/useURLSearchParams.ts
// Sync state with URL query parameters — enables shareable URLs

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom'; // React Router v6

type ParamSerializer<T> = {
  parse: (value: string) => T;
  stringify: (value: T) => string;
};

const serializers = {
  string: { parse: (v: string) => v, stringify: (v: string) => v },
  number: { parse: Number, stringify: String },
  boolean: { parse: (v: string) => v === 'true', stringify: String },
  json: { parse: JSON.parse, stringify: JSON.stringify },
} satisfies Record<string, ParamSerializer<unknown>>;

interface URLParamOptions<T> {
  key: string;
  defaultValue: T;
  serializer?: ParamSerializer<T>;
}

function useURLParam<T>({
  key,
  defaultValue,
  serializer = serializers.string as unknown as ParamSerializer<T>,
}: URLParamOptions<T>): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    const raw = searchParams.get(key);
    if (raw === null) return defaultValue;
    try {
      return serializer.parse(raw);
    } catch {
      return defaultValue;
    }
  }, [searchParams, key, defaultValue, serializer]);

  const setValue = useCallback((newValue: T) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newValue === defaultValue) {
        next.delete(key); // Clean URLs — don't show defaults
      } else {
        next.set(key, serializer.stringify(newValue));
      }
      return next;
    }, { replace: true }); // Don't pollute browser history
  }, [setSearchParams, key, defaultValue, serializer]);

  return [value, setValue];
}

// Usage: Table with URL-synced state
function DataTable() {
  const [page, setPage] = useURLParam({ key: 'page', defaultValue: 1, serializer: serializers.number });
  const [query, setQuery] = useURLParam({ key: 'q', defaultValue: '' });
  const [sort, setSort] = useURLParam({ key: 'sort', defaultValue: 'name' });
  
  // URL: /users?page=2&q=bruce&sort=email
  // Shareable, bookmarkable, back-button friendly!
  
  return (/* ... */);
}
```

## 14.3 useMediaQuery

```typescript
// hooks/browser/useMediaQuery.ts

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false; // SSR
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    
    // Modern browsers
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Semantic wrappers
const breakpoints = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
  dark: '(prefers-color-scheme: dark)',
  motion: '(prefers-reduced-motion: reduce)',
  touch: '(hover: none)',
} as const;

function useBreakpoint() {
  return {
    isSm: useMediaQuery(breakpoints.sm),
    isMd: useMediaQuery(breakpoints.md),
    isLg: useMediaQuery(breakpoints.lg),
    isXl: useMediaQuery(breakpoints.xl),
    isDark: useMediaQuery(breakpoints.dark),
    prefersReducedMotion: useMediaQuery(breakpoints.motion),
    isTouch: useMediaQuery(breakpoints.touch),
    isMobile: !useMediaQuery(breakpoints.md),
  };
}
```

## 14.4 useEventListener

```typescript
// hooks/browser/useEventListener.ts

type EventMap = WindowEventMap & DocumentEventMap & HTMLElementEventMap;

function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element?: undefined,
  options?: AddEventListenerOptions
): void;

function useEventListener<K extends keyof HTMLElementEventMap, T extends HTMLElement>(
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  element: React.RefObject<T>,
  options?: AddEventListenerOptions
): void;

function useEventListener(
  eventName: string,
  handler: (event: Event) => void,
  element?: React.RefObject<HTMLElement>,
  options?: AddEventListenerOptions
): void {
  const savedHandler = useRef(handler);
  savedHandler.current = handler;

  useEffect(() => {
    const target = element?.current ?? window;
    if (!target?.addEventListener) return;

    const listener = (event: Event) => savedHandler.current(event);
    target.addEventListener(eventName, listener, options);
    return () => target.removeEventListener(eventName, listener, options);
  }, [eventName, element, options]);
}

// Usage examples:
function Component() {
  const divRef = useRef<HTMLDivElement>(null);
  
  // Window event
  useEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
  
  // Element event
  useEventListener('click', (e) => {
    console.log('Clicked!', e.target);
  }, divRef);
  
  return <div ref={divRef}>Click me</div>;
}
```

---

# 15. Observer and Animation Hooks

## 15.1 useIntersectionObserver

```typescript
// hooks/browser/useIntersectionObserver.ts

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean; // Stop observing once visible
  initialIsIntersecting?: boolean;
}

interface UseIntersectionObserverReturn {
  ref: React.RefCallback<Element>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
}

function useIntersectionObserver({
  threshold = 0,
  root = null,
  rootMargin = '0%',
  freezeOnceVisible = false,
  initialIsIntersecting = false,
}: UseIntersectionObserverOptions = {}): UseIntersectionObserverReturn {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const elementRef = useRef<Element | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const isIntersecting = entry?.isIntersecting ?? initialIsIntersecting;
  const frozen = freezeOnceVisible && isIntersecting;

  const ref = useCallback((node: Element | null) => {
    // Cleanup previous observer
    observerRef.current?.disconnect();
    elementRef.current = node;

    if (!node || frozen) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);
        if (freezeOnceVisible && entry.isIntersecting) {
          observerRef.current?.disconnect();
        }
      },
      { threshold, root, rootMargin }
    );

    observerRef.current.observe(node);
  }, [threshold, root, rootMargin, frozen, freezeOnceVisible]);

  return { ref, isIntersecting, entry };
}

// Usage: Lazy loading images
function LazyImage({ src, alt }: { src: string; alt: string }) {
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    freezeOnceVisible: true,
  });

  return (
    <div ref={ref}>
      {isIntersecting ? (
        <img src={src} alt={alt} />
      ) : (
        <div className="placeholder" />
      )}
    </div>
  );
}
```

## 15.2 useResizeObserver

```typescript
// hooks/browser/useResizeObserver.ts

interface Size {
  width: number;
  height: number;
  top: number;
  left: number;
}

function useResizeObserver<T extends HTMLElement>(): [
  React.RefCallback<T>,
  Size
] {
  const [size, setSize] = useState<Size>({ width: 0, height: 0, top: 0, left: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();

    if (!node) return;

    observerRef.current = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height, top, left } = entry.contentRect;
      setSize({ width, height, top, left });
    });

    observerRef.current.observe(node);
  }, []);

  return [ref, size];
}

// Responsive component based on its own size (not viewport)
function ResponsiveCard() {
  const [ref, { width }] = useResizeObserver<HTMLDivElement>();
  
  return (
    <div ref={ref} className="card">
      {width < 400 ? <CompactView /> : <FullView />}
    </div>
  );
}
```

## 15.3 useAnimation Hook (CSS + JS)

```typescript
// hooks/ui/useAnimation.ts

type AnimationState = 'idle' | 'entering' | 'visible' | 'leaving' | 'hidden';

interface UseAnimationOptions {
  duration?: number;
  onComplete?: () => void;
}

function useAnimation(isVisible: boolean, options: UseAnimationOptions = {}) {
  const { duration = 300, onComplete } = options;
  const [state, setState] = useState<AnimationState>(isVisible ? 'visible' : 'hidden');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isVisible) {
      // Mount → start entering
      setState('entering');
      timerRef.current = setTimeout(() => {
        setState('visible');
        onComplete?.();
      }, duration);
    } else if (state !== 'hidden') {
      // Start leaving
      setState('leaving');
      timerRef.current = setTimeout(() => {
        setState('hidden');
        onComplete?.();
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isVisible, duration]);

  return {
    state,
    shouldMount: state !== 'hidden',
    isEntering: state === 'entering',
    isLeaving: state === 'leaving',
    isVisible: state === 'visible',
    style: {
      transition: `opacity ${duration}ms, transform ${duration}ms`,
      opacity: state === 'visible' ? 1 : 0,
      transform: state === 'entering' || state === 'hidden'
        ? 'translateY(8px)'
        : 'translateY(0)',
    } as React.CSSProperties,
  };
}

// Usage: Animated modal
function AnimatedModal({ isOpen, onClose, children }: ModalProps) {
  const animation = useAnimation(isOpen);
  
  if (!animation.shouldMount) return null;
  
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={animation.style}>
        {children}
      </div>
    </div>
  );
}
```

---

# 16. WebSocket, Polling, and Real-Time Hooks

## 16.1 useWebSocket

```typescript
// hooks/realtime/useWebSocket.ts

type WebSocketStatus = 'connecting' | 'open' | 'closing' | 'closed';

interface UseWebSocketOptions<T> {
  url: string;
  onMessage?: (data: T) => void;
  onError?: (event: Event) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  protocols?: string | string[];
}

function useWebSocket<T = unknown>({
  url,
  onMessage,
  onError,
  onOpen,
  onClose,
  reconnect = true,
  reconnectDelay = 3000,
  maxReconnectAttempts = 10,
  protocols,
}: UseWebSocketOptions<T>) {
  const [status, setStatus] = useState<WebSocketStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(reconnect);
  shouldReconnectRef.current = reconnect;

  const callbacksRef = useRef({ onMessage, onError, onOpen, onClose });
  callbacksRef.current = { onMessage, onError, onOpen, onClose };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    wsRef.current = new WebSocket(url, protocols);
    setStatus('connecting');

    wsRef.current.onopen = () => {
      setStatus('open');
      setReconnectAttempts(0);
      callbacksRef.current.onOpen?.();
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as T;
        setLastMessage(data);
        callbacksRef.current.onMessage?.(data);
      } catch {
        // Handle non-JSON messages
        setLastMessage(event.data as T);
        callbacksRef.current.onMessage?.(event.data as T);
      }
    };

    wsRef.current.onerror = (event) => {
      callbacksRef.current.onError?.(event);
    };

    wsRef.current.onclose = (event) => {
      setStatus('closed');
      callbacksRef.current.onClose?.(event);

      if (shouldReconnectRef.current && !event.wasClean) {
        setReconnectAttempts(prev => {
          if (prev >= maxReconnectAttempts) return prev;
          
          const delay = reconnectDelay * Math.pow(1.5, prev); // Exponential backoff
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
          
          return prev + 1;
        });
      }
    };
  }, [url, protocols, reconnectDelay, maxReconnectAttempts]);

  useEffect(() => {
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close(1000, 'Component unmounted');
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return false;
    }
    wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    return true;
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    wsRef.current?.close(1000, 'Manual disconnect');
  }, []);

  return {
    status,
    isConnected: status === 'open',
    lastMessage,
    send,
    disconnect,
    reconnect: connect,
    reconnectAttempts,
  };
}
```

## 16.2 usePolling

```typescript
// hooks/realtime/usePolling.ts

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>;
  interval: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  retryOnError?: boolean;
}

function usePolling<T>({
  fetcher,
  interval,
  enabled = true,
  onSuccess,
  onError,
  retryOnError = true,
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const fetcherRef = useRef(fetcher);
  const callbacksRef = useRef({ onSuccess, onError });
  fetcherRef.current = fetcher;
  callbacksRef.current = { onSuccess, onError };

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const poll = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetcherRef.current();
      if (!isMountedRef.current) return;
      setData(result);
      setError(null);
      setPollCount(c => c + 1);
      callbacksRef.current.onSuccess?.(result);
    } catch (err) {
      if (!isMountedRef.current) return;
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      callbacksRef.current.onError?.(error);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    poll(); // Initial fetch

    const id = setInterval(() => {
      if (!error || retryOnError) poll();
    }, interval);

    return () => clearInterval(id);
  }, [enabled, interval, poll, error, retryOnError]);

  return { data, error, isLoading, pollCount, refetch: poll };
}

// Usage: Live dashboard metrics
function LiveMetrics() {
  const { data: metrics } = usePolling({
    fetcher: () => fetch('/api/metrics').then(r => r.json()),
    interval: 5000, // Poll every 5 seconds
    onError: (err) => console.error('Metrics poll failed:', err),
  });

  return <MetricsDashboard data={metrics} />;
}
```

## 16.3 useRealTimeSync — Combining WebSocket + REST

```typescript
// hooks/realtime/useRealTimeSync.ts
// Pattern: REST for initial data, WebSocket for updates

interface RealTimeOptions<T> {
  fetchInitial: () => Promise<T[]>;
  wsUrl: string;
  onUpdate: (current: T[], event: { type: 'add' | 'update' | 'delete'; item: T }) => T[];
  idKey: keyof T;
}

function useRealTimeSync<T extends { [key: string]: unknown }>({
  fetchInitial,
  wsUrl,
  onUpdate,
  idKey,
}: RealTimeOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetchInitial);
  fetcherRef.current = fetchInitial;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Initial data load
  useEffect(() => {
    fetcherRef.current()
      .then(data => {
        setItems(data);
        setIsInitialLoading(false);
      })
      .catch(err => {
        setError(err);
        setIsInitialLoading(false);
      });
  }, []);

  // WebSocket for live updates
  const { isConnected } = useWebSocket<{
    type: 'add' | 'update' | 'delete';
    item: T;
  }>({
    url: wsUrl,
    onMessage: (event) => {
      setItems(current => onUpdateRef.current(current, event));
    },
  });

  return { items, isInitialLoading, error, isLive: isConnected };
}
```

---

# 17. Offline-First and Error Boundary Hooks

## 17.1 useOnlineStatus

```typescript
// hooks/browser/useOnlineStatus.ts

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Reset "was offline" after a brief period
      setTimeout(() => setWasOffline(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isOffline: !isOnline, wasOffline };
}

// Offline-first mutation with queue
function useOfflineMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  queueKey: string
) {
  const { isOnline } = useOnlineStatus();
  const [queue, setQueue, clearQueue] = useLocalStorage<TVariables[]>(queueKey, []);
  const { mutate } = useMutation(mutationFn);

  // Flush queue when back online
  useEffect(() => {
    if (!isOnline || queue.length === 0) return;

    const processQueue = async () => {
      for (const item of queue) {
        try {
          await mutate(item);
        } catch {
          // If any fail, stop — leave remaining in queue
          break;
        }
      }
      clearQueue();
    };

    processQueue();
  }, [isOnline, queue]);

  const submitOrQueue = useCallback((variables: TVariables) => {
    if (isOnline) {
      mutate(variables);
    } else {
      setQueue(prev => [...prev, variables]);
    }
  }, [isOnline, mutate, setQueue]);

  return {
    submit: submitOrQueue,
    queuedCount: queue.length,
    isOnline,
  };
}
```

## 17.2 useErrorBoundary

```typescript
// hooks/error/useErrorBoundary.ts
// Programmatically throw errors into the nearest ErrorBoundary

function useErrorBoundary() {
  const [, setState] = useState(null);

  // Throwing inside setState causes React to propagate to ErrorBoundary
  const throwError = useCallback((error: Error) => {
    setState(() => { throw error; });
  }, []);

  return { throwError };
}

// Usage: Throw async errors into boundary
function UserProfile({ userId }: { userId: string }) {
  const { throwError } = useErrorBoundary();
  const { data, error } = useFetch<User>(`/api/users/${userId}`);

  if (error) {
    // Propagate to nearest ErrorBoundary
    throwError(error);
  }

  return <div>{data?.name}</div>;
}

// Error boundary component (class — required for componentDidCatch)
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to error service
    errorService.report(error, info);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

---

# 18. Analytics, Accessibility, and Feature Flag Hooks

## 18.1 useAnalytics

```typescript
// hooks/analytics/useAnalytics.ts

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

// Analytics service interface — swappable (Segment, Mixpanel, GA4)
interface AnalyticsService {
  track: (event: AnalyticsEvent) => void;
  page: (name: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
}

const AnalyticsContext = createContext<AnalyticsService | null>(null);

function useAnalytics() {
  const service = useContext(AnalyticsContext);

  const track = useCallback((name: string, properties?: Record<string, unknown>) => {
    service?.track({ name, properties, timestamp: Date.now() });
  }, [service]);

  const trackClick = useCallback((elementName: string, properties?: Record<string, unknown>) => {
    track('element_clicked', { element: elementName, ...properties });
  }, [track]);

  return { track, trackClick };
}

// Auto-track component mounts
function useTrackView(name: string, properties?: Record<string, unknown>) {
  const { track } = useAnalytics();

  useEffect(() => {
    track('page_viewed', { page: name, ...properties });
  // Only track on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

## 18.2 useFeatureFlag

```typescript
// hooks/useFeatureFlag.ts

interface FeatureFlagConfig {
  defaultValue?: boolean;
  userId?: string; // For user-specific rollouts
}

// Simple implementation — production uses LaunchDarkly, Unleash, etc.
function useFeatureFlag(flagKey: string, config: FeatureFlagConfig = {}): boolean {
  const { defaultValue = false } = config;
  const { user } = useAuth();

  const [isEnabled, setIsEnabled] = useState(defaultValue);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/feature-flags/${flagKey}?userId=${user?.id ?? 'anonymous'}`, {
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(({ enabled }) => setIsEnabled(enabled))
      .catch(() => setIsEnabled(defaultValue));

    return () => controller.abort();
  }, [flagKey, user?.id, defaultValue]);

  return isEnabled;
}

// Usage
function BetaFeature() {
  const isEnabled = useFeatureFlag('new-checkout-flow');
  return isEnabled ? <NewCheckout /> : <OldCheckout />;
}
```

## 18.3 useAccessibility

```typescript
// hooks/a11y/useFocusTrap.ts

function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
    );

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    // Focus first element on activation
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab: going backwards
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        // Tab: going forwards
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  return containerRef;
}

// hooks/a11y/useAnnounce.ts
// For screen reader announcements
function useAnnounce() {
  const [announcement, setAnnouncement] = useState('');

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement(''); // Reset to retrigger
    setTimeout(() => setAnnouncement(message), 100);
  }, []);

  // Render an aria-live region (hidden visually)
  const AnnouncerPortal = useCallback(() => (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1, height: 1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
      }}
    >
      {announcement}
    </div>
  ), [announcement]);

  return { announce, AnnouncerPortal };
}
```

---

## Volume 2 Senior Challenge

**Build a real-time collaborative presence system** using composition of hooks from this volume:

```typescript
// Target API
function CollaborativeDocument({ docId }: { docId: string }) {
  const presence = usePresence(docId); // Who's online
  const document = useRealTimeSync({...}); // Live content
  const cursor = useCursorTracking(docId); // Other users' cursors
  const permission = usePermissions(); // Can they edit?
  
  return (
    <Editor
      content={document.items[0]?.content}
      collaborators={presence.users}
      cursors={cursor.positions}
      readOnly={!permission.can('document:edit')}
    />
  );
}
```

Requirements:
- `usePresence`: WebSocket-based, shows who's in the doc, cleans up on unmount
- Offline-first: queues edits when disconnected
- Reconnects with exponential backoff
- Announces collaborator joins/leaves to screen readers
- Tracks analytics events (join, edit, leave)
- Feature flag gates collaborative features

**FAANG-Level Thought**: Google Docs uses operational transforms (OT) or CRDTs for conflict resolution. The hooks above handle the React binding layer — the hard part is the underlying algorithm. At scale, presence is handled by a separate presence service (Redis pub/sub) decoupled from document storage. Each concern maps to a separate hook, which maps to a separate service.

---

*End of Volume 2 — Continue in react-hooks-mastery-vol3.md*
