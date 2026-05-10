# ⚛️ Mastering Custom Hooks in React + TypeScript
## Volume 3: Enterprise Architecture, Performance, Testing, Production

---

# 19. Performance Deep Dive

## 19.1 The Stale Closure Problem — Exhaustive Reference

> **Mental Model**: A closure captures variables at the time of its creation. In React, effects and callbacks capture the values from the render they were created in. If state changes but the closure isn't recreated (missing deps), it reads **stale** (old) values.

```typescript
// ❌ CLASSIC STALE CLOSURE
function useBadTimer() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1); // ❌ 'count' is captured at 0, always adds 1 to 0
      console.log(count);  // Always logs 0
    }, 1000);
    return () => clearInterval(id);
  }, []); // ❌ Empty deps — never re-runs — stale closure forever
  
  return count;
}

// ✅ FIX 1: Functional updater (for setState only)
function useGoodTimer1() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const id = setInterval(() => {
      setCount(c => c + 1); // ✅ Gets current value, no closure
    }, 1000);
    return () => clearInterval(id);
  }, []);
  
  return count;
}

// ✅ FIX 2: Ref to capture latest value (for non-state values)
function useStaleClosureFix() {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  countRef.current = count; // Always up-to-date
  
  useEffect(() => {
    const id = setInterval(() => {
      console.log(countRef.current); // ✅ Always current
      setCount(c => c + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  
  return count;
}

// ✅ FIX 3: Include in deps (re-runs effect on change)
function useCorrectDeps(callback: () => void) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const id = setInterval(() => {
      callback(); // ✅ Correct: callback in deps
    }, 1000);
    return () => clearInterval(id);
  }, [callback]); // Effect re-runs if callback changes
  
  return count;
}
```

## 19.2 Race Conditions — Complete Patterns

```typescript
// Pattern 1: AbortController (best for fetch)
function useAbortableFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setData(data))
      .catch(err => {
        if (err.name !== 'AbortError') throw err;
        // AbortError: request cancelled — safe to ignore
      });

    return () => controller.abort(); // Cancel on cleanup (new dep or unmount)
  }, [url]);

  return data;
}

// Pattern 2: Request ID (for non-cancellable operations)
function useRequestId<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const requestIdRef = useRef(0);

  const execute = useCallback(async () => {
    const id = ++requestIdRef.current;

    const result = await fn();

    // Only update if this is still the latest request
    if (id === requestIdRef.current) {
      setData(result);
    }
  }, [fn]);

  return { data, execute };
}

// Pattern 3: Settled check (generic)
function useAsyncEffect(
  effect: (options: { isCancelled: () => boolean }) => Promise<void>,
  deps: React.DependencyList
) {
  useEffect(() => {
    let cancelled = false;
    effect({ isCancelled: () => cancelled });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Usage
function UserData({ id }: { id: string }) {
  const [user, setUser] = useState<User | null>(null);

  useAsyncEffect(async ({ isCancelled }) => {
    const data = await userService.getById(id);
    if (!isCancelled()) setUser(data);
  }, [id]);

  return user ? <UserCard user={user} /> : null;
}
```

## 19.3 useMemo and useCallback — When to Use and When NOT to

```typescript
// ❌ PREMATURE OPTIMIZATION: useMemo for cheap operations
function Bad({ name }: { name: string }) {
  // Concatenation is nanoseconds — memoization overhead costs more
  const displayName = useMemo(() => `Hello, ${name}!`, [name]);
  return <div>{displayName}</div>;
}

// ✅ Use useMemo when:
// 1. Expensive computation
const sortedData = useMemo(
  () => [...data].sort(complexComparator), // O(n log n) — worth memoizing
  [data]
);

// 2. Reference stability needed for deps
const filters = useMemo(
  () => ({ status: 'active', role: 'admin' }),
  [] // Object identity stable — won't cause useEffect to re-run
);

// 3. Preventing expensive child re-renders
const processedRows = useMemo(
  () => rows.map(processRow), // Child takes this as prop + is React.memo'd
  [rows]
);

// ❌ useCallback anti-pattern: wrapping everything
function Bad2({ items }: { items: string[] }) {
  // Handler with no deps doesn't need useCallback
  const handleClick = useCallback(() => console.log('clicked'), []);
  // Unless: this is passed to memo'd children
  return <ul>{items.map(i => <li key={i} onClick={handleClick}>{i}</li>)}</ul>;
}

// ✅ useCallback when:
// 1. Passed to React.memo'd children
const handleAddToCart = useCallback((id: string) => {
  dispatch({ type: 'ADD', payload: id });
}, [dispatch]); // dispatch is stable from useReducer/Zustand

// 2. Used as useEffect dependency
useEffect(() => {
  handleAddToCart(defaultId);
}, [handleAddToCart]); // Stable ref means effect doesn't re-run
```

## 19.4 Preventing Unnecessary Re-renders — The Full Toolkit

```typescript
// Tool 1: React.memo for components
const ExpensiveChart = React.memo(({ data, config }: ChartProps) => {
  // Only re-renders if data or config reference changes
  return <Chart data={data} config={config} />;
}, (prevProps, nextProps) => {
  // Custom comparison (optional)
  return prevProps.data.length === nextProps.data.length &&
    prevProps.config.type === nextProps.config.type;
});

// Tool 2: State slicing — subscribe to only what you need
// With Zustand:
function UserAvatar() {
  // ✅ Only re-renders when user.avatar changes
  const avatar = useUserStore(state => state.user?.avatar);
  return <img src={avatar} />;
}

// ❌ BAD: Re-renders on any user change
function UserAvatarBad() {
  const user = useUserStore(state => state.user);
  return <img src={user?.avatar} />;
}

// Tool 3: Context splitting — split frequently-changing from stable
const UserActionsContext = createContext<UserActions | null>(null);
const UserDataContext = createContext<UserData | null>(null);

// Components that need actions don't re-render when user data changes
function DeleteButton() {
  const actions = useContext(UserActionsContext); // Stable reference
  return <button onClick={actions?.delete}>Delete</button>;
}

// Tool 4: useDeferredValue for non-urgent updates (React 18+)
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  // Renders with current query immediately, shows deferred results
  // User sees input updates instantly, results update when possible
  const results = useSearchResults(deferredQuery);
  return <ResultsList results={results} />;
}

// Tool 5: startTransition for non-urgent state updates (React 18+)
function useTransitionSearch() {
  const [query, setQuery] = useState('');
  const [, startTransition] = useTransition();

  const handleChange = useCallback((value: string) => {
    setQuery(value); // Urgent: update input immediately
    startTransition(() => {
      // Non-urgent: search can wait if there's more pressing work
      setSearchQuery(value);
    });
  }, []);

  return { query, handleChange };
}
```

## 19.5 useRef Deep Dive

```typescript
// The three uses of useRef:

// 1. DOM reference
function AutoFocusInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return <input ref={inputRef} />;
}

// 2. Mutable value that doesn't trigger re-render
function useStopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const start = useCallback(() => {
    startTimeRef.current = Date.now() - elapsed * 1000;
    
    const tick = () => {
      setElapsed((Date.now() - (startTimeRef.current ?? 0)) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    
    rafRef.current = requestAnimationFrame(tick);
  }, [elapsed]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return { elapsed, start, stop };
}

// 3. Stable callback reference (the useStableCallback pattern)
function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef<T>(fn);
  useLayoutEffect(() => { ref.current = fn; });
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}

// 4. Previous value
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }); // No deps — runs after every render, captures previous
  return ref.current;
}

// Usage: Animate on change, compare old/new
function ValueTracker({ value }: { value: number }) {
  const previous = usePrevious(value);
  const increased = previous !== undefined && value > previous;
  
  return (
    <span style={{ color: increased ? 'green' : 'red' }}>
      {value}
    </span>
  );
}
```

---

# 20. Testing Strategies

## 20.1 Testing Philosophy for Hooks

```
Test behavior, not implementation.
Test the hook's contract: given these inputs → these outputs and effects.
Mock external dependencies (fetch, localStorage, WebSocket).
Test error states, loading states, and edge cases.
```

## 20.2 Setup: @testing-library/react-hooks / renderHook

```typescript
// __tests__/useCounter.test.ts
import { renderHook, act } from '@testing-library/react';
import { useCounter } from '../hooks/useCounter';

describe('useCounter', () => {
  it('initializes with default value', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('initializes with custom value', () => {
    const { result } = renderHook(() => useCounter({ initialValue: 10 }));
    expect(result.current.count).toBe(10);
  });

  it('increments correctly', () => {
    const { result } = renderHook(() => useCounter({ step: 5 }));
    
    act(() => { result.current.increment(); });
    expect(result.current.count).toBe(5);
    
    act(() => { result.current.increment(); });
    expect(result.current.count).toBe(10);
  });

  it('respects max boundary', () => {
    const { result } = renderHook(() => useCounter({ initialValue: 9, max: 10, step: 5 }));
    
    act(() => { result.current.increment(); });
    expect(result.current.count).toBe(10); // Clamped to max
    
    act(() => { result.current.increment(); });
    expect(result.current.count).toBe(10); // Stays at max
  });

  it('resets to initial value', () => {
    const { result } = renderHook(() => useCounter({ initialValue: 5 }));
    
    act(() => { result.current.increment(); });
    act(() => { result.current.reset(); });
    
    expect(result.current.count).toBe(5);
  });

  it('provides stable function references', () => {
    const { result, rerender } = renderHook(() => useCounter());
    
    const incrementRef1 = result.current.increment;
    rerender();
    const incrementRef2 = result.current.increment;
    
    expect(incrementRef1).toBe(incrementRef2); // Same reference
  });
});
```

## 20.3 Testing Async Hooks

```typescript
// __tests__/useFetch.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useFetch } from '../hooks/useFetch';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useFetch', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('starts in loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    const { result } = renderHook(() => useFetch('/api/data'));
    
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('sets data on success', async () => {
    const mockData = { id: 1, name: 'Bruce' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    
    const { result } = renderHook(() => useFetch('/api/user'));
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('sets error on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
    
    const { result } = renderHook(() => useFetch('/api/user/999'));
    
    await waitFor(() => expect(result.current.isError).toBe(true));
    
    expect(result.current.error?.message).toContain('404');
  });

  it('cancels request on unmount', () => {
    const abortSpy = jest.fn();
    mockFetch.mockImplementation((_url, options) => {
      options.signal.addEventListener('abort', abortSpy);
      return new Promise(() => {});
    });
    
    const { unmount } = renderHook(() => useFetch('/api/slow'));
    unmount();
    
    expect(abortSpy).toHaveBeenCalled();
  });

  it('refetches on url change', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 1 }) });
    
    const { rerender } = renderHook(({ url }) => useFetch(url), {
      initialProps: { url: '/api/users/1' },
    });
    
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    
    rerender({ url: '/api/users/2' });
    
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch).toHaveBeenLastCalledWith('/api/users/2', expect.any(Object));
  });
});
```

## 20.4 Mocking Custom Hooks in Component Tests

```typescript
// components/__tests__/UserProfile.test.tsx

// The hook we want to mock
jest.mock('../hooks/useUser', () => ({
  useUser: jest.fn(),
}));

import { useUser } from '../hooks/useUser';
import { render, screen } from '@testing-library/react';
import { UserProfile } from '../components/UserProfile';

const mockedUseUser = jest.mocked(useUser);

describe('UserProfile', () => {
  it('shows loading state', () => {
    mockedUseUser.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    
    render(<UserProfile userId="123" />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows user data when loaded', () => {
    mockedUseUser.mockReturnValue({
      data: { id: '123', name: 'Bruce Wayne', email: 'bruce@wayne.com' },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    
    render(<UserProfile userId="123" />);
    
    expect(screen.getByText('Bruce Wayne')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockedUseUser.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load user'),
      refetch: jest.fn(),
    });
    
    render(<UserProfile userId="123" />);
    
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});
```

## 20.5 Testing WebSocket Hooks

```typescript
// __tests__/useWebSocket.test.ts

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = WebSocket.CONNECTING;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  
  constructor(public url: string, public protocols?: string | string[]) {
    MockWebSocket.instances.push(this);
  }
  
  send = jest.fn();
  close = jest.fn().mockImplementation(() => {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ wasClean: true } as CloseEvent);
  });
  
  // Test helpers
  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
  
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  
  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it('connects on mount', () => {
    renderHook(() => useWebSocket({ url: 'ws://test.com' }));
    
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe('ws://test.com');
  });

  it('receives messages', async () => {
    const onMessage = jest.fn();
    
    renderHook(() => useWebSocket({
      url: 'ws://test.com',
      onMessage,
    }));
    
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({ type: 'update', data: 42 });
    });
    
    expect(onMessage).toHaveBeenCalledWith({ type: 'update', data: 42 });
  });

  it('closes connection on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket({ url: 'ws://test.com' }));
    
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });
    
    unmount();
    
    expect(MockWebSocket.instances[0].close).toHaveBeenCalled();
  });
});
```

---

# 21. Enterprise Hook Architecture

## 21.1 The Domain-Driven Hook System

```
enterprise-app/
├── packages/
│   ├── hooks/                  ← Shared hook library (monorepo package)
│   │   ├── core/               ← Framework hooks (no domain knowledge)
│   │   │   ├── async/
│   │   │   │   ├── useQuery.ts
│   │   │   │   ├── useMutation.ts
│   │   │   │   └── useSubscription.ts
│   │   │   ├── browser/
│   │   │   │   ├── useLocalStorage.ts
│   │   │   │   ├── useMediaQuery.ts
│   │   │   │   └── useEventListener.ts
│   │   │   └── ui/
│   │   │       ├── useDisclosure.ts
│   │   │       ├── useFocusTrap.ts
│   │   │       └── useDebounce.ts
│   │   └── package.json        ← "@company/hooks": "workspace:*"
│   │
│   └── features/               ← Domain hooks (import from core)
│       ├── auth/
│       │   ├── useAuth.ts
│       │   ├── usePermissions.ts
│       │   └── useSession.ts
│       ├── catalog/
│       │   ├── useProduct.ts
│       │   ├── useProductSearch.ts
│       │   └── useInventory.ts
│       └── orders/
│           ├── useOrder.ts
│           ├── useOrderHistory.ts
│           └── useCheckout.ts
│
├── apps/
│   ├── storefront/             ← Uses @company/hooks + features hooks
│   ├── admin/
│   └── mobile/
```

## 21.2 Hooks with Dependency Injection

```typescript
// The problem: hooks hardcode their dependencies
// hooks/useProduct.ts — TIGHTLY COUPLED ❌
function useProduct(id: string) {
  // Hardcoded — can't swap for testing or different environments
  return useFetch<Product>(`https://api.mycompany.com/products/${id}`);
}

// Solution: Inject dependencies through context
// ──── Define service interface ────────────────────────────
interface ProductService {
  getById: (id: string) => Promise<Product>;
  create: (input: CreateProductInput) => Promise<Product>;
  update: (id: string, input: Partial<Product>) => Promise<Product>;
  delete: (id: string) => Promise<void>;
}

// ──── Create service context ──────────────────────────────
const ServiceContext = createContext<{
  products: ProductService;
  orders: OrderService;
  users: UserService;
} | null>(null);

function useServices() {
  const context = useContext(ServiceContext);
  if (!context) throw new Error('ServiceProvider required');
  return context;
}

// ──── Hook using injected service ────────────────────────
function useProduct(id: string) {
  const { products } = useServices();
  
  return useQuery(['product', id], () => products.getById(id), {
    enabled: Boolean(id),
  });
}

// ──── Production provider ─────────────────────────────────
function ProductionServiceProvider({ children }: { children: React.ReactNode }) {
  const services = useMemo(() => ({
    products: new HttpProductService('https://api.mycompany.com'),
    orders: new HttpOrderService('https://api.mycompany.com'),
    users: new HttpUserService('https://api.mycompany.com'),
  }), []);
  
  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
}

// ──── Test provider ───────────────────────────────────────
function TestServiceProvider({ children, overrides = {} }: {
  children: React.ReactNode;
  overrides?: Partial<Services>;
}) {
  const services = {
    products: new MockProductService(),
    orders: new MockOrderService(),
    users: new MockUserService(),
    ...overrides,
  };
  
  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
}
```

## 21.3 The Query Cache Architecture

```typescript
// For large apps, coordinate cache invalidation across hooks

// ──── Query key factory pattern ───────────────────────────
// Prevents magic strings, enables type-safe invalidation

const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: UserFilters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },
  products: {
    all: ['products'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    byCategory: (cat: string) => ['products', 'list', cat] as const,
  },
} as const;

// Usage with React Query
function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),  // Type-safe key
    queryFn: () => userService.getById(id),
  });
}

function useDeleteUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: userService.delete,
    onSuccess: (_, deletedId) => {
      // Invalidate all user queries — detail and lists
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
```

---

# 22. SSR, Next.js, and React Server Components

## 22.1 SSR Safety Checklist

```typescript
// The golden rule: hooks using browser APIs must guard against SSR

// ❌ Crashes on server — window doesn't exist
function useBadWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,   // ❌ ReferenceError on server
    height: window.innerHeight,
  });
  return size;
}

// ✅ Safe for SSR
function useWindowSize() {
  const [size, setSize] = useState({
    width: 0,  // Safe default for server
    height: 0,
  });

  useEffect(() => {
    // Only runs on client
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update(); // Set initial client value
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return size;
}

// ✅ Or use lazy initializer (still executes on client only for useEffect-driven hooks)
function useLocalStorageSafe<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial; // SSR guard
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initial;
  });
  return [value, setValue] as const;
}
```

## 22.2 Next.js App Router — Hooks and Server Components

```typescript
// CRITICAL CONCEPT: Custom hooks can ONLY be used in Client Components
// Server Components cannot use useState, useEffect, or any hooks

// ❌ WRONG: Hook in a Server Component
// app/users/page.tsx (Server Component by default)
export default function UsersPage() {
  const users = useUsers(); // ❌ Error: Hooks in Server Components
  return <UserList users={users} />;
}

// ✅ CORRECT: Server Component fetches, passes to client
// app/users/page.tsx (Server Component)
async function UsersPage() {
  // Direct async/await — no hooks needed
  const users = await userService.list();
  return <UserList users={users} />;  // UserList can be a server or client component
}

// app/users/UserList.tsx (Client Component — needs interactivity)
'use client';

function UserList({ users }: { users: User[] }) {
  // Client Component: can use hooks
  const { search, setSearch, filteredUsers } = useUserSearch(users);
  
  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      {filteredUsers.map(u => <UserCard key={u.id} user={u} />)}
    </div>
  );
}

// Pattern: Hydration-aware hook
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  return hydrated;
}

function ClientOnlyComponent() {
  const hydrated = useHydrated();
  if (!hydrated) return null; // Prevent hydration mismatch
  return <ComponentThatNeedsWindow />;
}
```

## 22.3 Hooks with Suspense

```typescript
// React 18 Suspense + hooks

// useSuspenseQuery: throws a promise (Suspense catches it)
function useSuspenseQuery<T>(key: string, fetcher: () => Promise<T>): T {
  // The cache tracks promises by key
  const cached = suspenseCache.get(key);
  
  if (!cached) {
    // First call: start fetching, throw promise
    const promise = fetcher().then(
      data => { suspenseCache.set(key, { status: 'success', data }); },
      error => { suspenseCache.set(key, { status: 'error', error }); }
    );
    suspenseCache.set(key, { status: 'pending', promise });
    throw promise; // Suspense catches this
  }
  
  if (cached.status === 'pending') throw cached.promise;
  if (cached.status === 'error') throw cached.error;
  return cached.data as T;
}

// Usage with Suspense
function UserCard({ userId }: { userId: string }) {
  // This can throw — Suspense above handles loading
  const user = useSuspenseQuery(['user', userId], () => userService.getById(userId));
  
  return <div>{user.name}</div>; // Never null — Suspense handles loading
}

function App() {
  return (
    <ErrorBoundary fallback={<ErrorUI />}>
      <Suspense fallback={<Skeleton />}>
        <UserCard userId="123" />
      </Suspense>
    </ErrorBoundary>
  );
}
```

---

# 23. Hooks with State Management Libraries

## 23.1 Hooks with Zustand

```typescript
// stores/useProductStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface ProductStore {
  products: Product[];
  filters: ProductFilters;
  isLoading: boolean;
  // Actions
  fetchProducts: () => Promise<void>;
  addProduct: (product: Product) => void;
  setFilters: (filters: Partial<ProductFilters>) => void;
}

const useProductStore = create<ProductStore>()(
  subscribeWithSelector((set, get) => ({
    products: [],
    filters: { category: null, minPrice: 0, maxPrice: Infinity },
    isLoading: false,

    fetchProducts: async () => {
      set({ isLoading: true });
      try {
        const products = await productService.list(get().filters);
        set({ products, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    },

    addProduct: (product) =>
      set(state => ({ products: [...state.products, product] })),

    setFilters: (filters) =>
      set(state => ({ filters: { ...state.filters, ...filters } })),
  }))
);

// Domain hooks built on top of the store
function useProducts() {
  const { products, isLoading, fetchProducts } = useProductStore();
  
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);
  
  return { products, isLoading, refetch: fetchProducts };
}

// Selector hook — only re-renders when filtered result changes
function useFilteredProducts() {
  return useProductStore(state => {
    const { products, filters } = state;
    return products.filter(p => {
      if (filters.category && p.category !== filters.category) return false;
      if (p.price < filters.minPrice || p.price > filters.maxPrice) return false;
      return true;
    });
  });
}
```

## 23.2 Hooks with React Query (TanStack Query)

```typescript
// The most production-ready pattern for data fetching

// hooks/queries/useUserQueries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ──── Keys ────────────────────────────────────────────────
export const userKeys = {
  all: ['users'] as const,
  detail: (id: string) => ['users', id] as const,
  me: ['users', 'me'] as const,
};

// ──── Read hooks ──────────────────────────────────────────
export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.me,
    queryFn: () => userService.getCurrentUser(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      if (error.message.includes('401')) return false; // Don't retry auth errors
      return failureCount < 3;
    },
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => userService.getById(id),
    enabled: Boolean(id),
  });
}

// ──── Write hooks ─────────────────────────────────────────
export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<User>) =>
      userService.update(id, data),
    
    // Optimistic update
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: userKeys.detail(id) });
      
      const previousUser = queryClient.getQueryData<User>(userKeys.detail(id));
      
      queryClient.setQueryData<User>(userKeys.detail(id), old =>
        old ? { ...old, ...updates } : old
      );
      
      return { previousUser, id };
    },
    
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousUser) {
        queryClient.setQueryData(userKeys.detail(context.id), context.previousUser);
      }
    },
    
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) });
    },
  });
}
```

---

# 24. Production Case Studies

## 24.1 Case Study: Multi-Tab State Sync

```typescript
// Problem: User has dashboard open in 3 tabs.
// They update profile in tab 1 — tabs 2 and 3 still show old data.

// Solution: Broadcast Channel API for cross-tab sync

function useCrossTabSync<T>(key: string, value: T, onMessage: (data: T) => void) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    
    channelRef.current = new BroadcastChannel(key);
    
    channelRef.current.onmessage = (event) => {
      onMessageRef.current(event.data);
    };
    
    return () => channelRef.current?.close();
  }, [key]);

  const broadcast = useCallback((data: T) => {
    channelRef.current?.postMessage(data);
  }, []);

  // Broadcast when value changes
  const prevValue = usePrevious(value);
  useEffect(() => {
    if (prevValue !== undefined && prevValue !== value) {
      broadcast(value);
    }
  }, [value, prevValue, broadcast]);

  return broadcast;
}

// Usage in auth hook: log out in all tabs when one logs out
function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  
  useCrossTabSync('auth:user', user, (syncedUser) => {
    setUser(syncedUser); // Sync from other tabs
  });
  
  const logout = async () => {
    await authService.logout();
    setUser(null);
    // useCrossTabSync will broadcast null → all tabs log out
  };
  
  return { user, logout };
}
```

## 24.2 Case Study: Progressive Data Loading

```typescript
// Pattern: Skeleton → Stale data → Fresh data
// Prevents layout shift and empty states

function useProgressiveData<T>(key: string, fetcher: () => Promise<T>) {
  // Layer 1: Persisted data from last session (instant)
  const [persistedData, setPersistedData] = useLocalStorage<T | null>(key, null);
  
  // Layer 2: Fresh data from server
  const { data: freshData, isLoading, error } = useQuery(key, fetcher, {
    staleTime: 0, // Always refetch
    placeholderData: persistedData ?? undefined,
  });

  // Update persistence when fresh data arrives
  useEffect(() => {
    if (freshData) setPersistedData(freshData);
  }, [freshData]);

  return {
    data: freshData ?? persistedData,
    isLoading: isLoading && !persistedData,  // Only show skeleton if no cache
    isStale: Boolean(persistedData && isLoading),
    error,
  };
}
```

## 24.3 Case Study: Request Deduplication

```typescript
// Problem: 3 components mount simultaneously, all call useUser('123')
// Without deduplication: 3 network requests

// Solution: In-flight request registry
const inFlightRequests = new Map<string, Promise<unknown>>();

function useDedupedFetch<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);

    let request = inFlightRequests.get(key) as Promise<T> | undefined;
    
    if (!request) {
      request = fetcher();
      inFlightRequests.set(key, request);
      request.finally(() => inFlightRequests.delete(key));
    }

    request
      .then(result => setData(result))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [key]);

  return { data, isLoading };
}
// Note: React Query does this automatically and much better.
```

---

# 25. Build a Production Hook Library from Scratch

## 25.1 Library Architecture

```
@company/react-hooks/
├── src/
│   ├── async/
│   │   ├── useQuery.ts          ← Data fetching
│   │   ├── useMutation.ts       ← Write operations  
│   │   ├── useInfiniteQuery.ts  ← Paginated data
│   │   └── QueryProvider.tsx    ← Cache + context
│   ├── browser/
│   │   ├── useLocalStorage.ts
│   │   ├── useSessionStorage.ts
│   │   ├── useMediaQuery.ts
│   │   ├── useOnlineStatus.ts
│   │   └── useEventListener.ts
│   ├── ui/
│   │   ├── useDisclosure.ts     ← open/close for modals/drawers
│   │   ├── useDebounce.ts
│   │   ├── useThrottle.ts
│   │   ├── usePrevious.ts
│   │   └── useStableCallback.ts
│   ├── observers/
│   │   ├── useIntersectionObserver.ts
│   │   ├── useResizeObserver.ts
│   │   └── useMutationObserver.ts
│   └── index.ts                 ← Public API (re-exports)
├── tests/
│   └── ... (mirrors src/)
├── package.json
└── tsconfig.json
```

## 25.2 The Complete useDisclosure Hook

```typescript
// src/ui/useDisclosure.ts — production-ready disclosure hook
// Used for: modals, drawers, dropdowns, tooltips, accordions

interface UseDisclosureOptions {
  defaultIsOpen?: boolean;
  isOpen?: boolean;             // Controlled mode
  onOpen?: () => void;
  onClose?: () => void;
  onToggle?: (isOpen: boolean) => void;
  id?: string;                  // For aria attributes
}

interface UseDisclosureReturn {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
  getButtonProps: (props?: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.ButtonHTMLAttributes<HTMLButtonElement>;
  getDisclosureProps: (props?: React.HTMLAttributes<HTMLElement>) =>
    React.HTMLAttributes<HTMLElement>;
}

function useDisclosure({
  defaultIsOpen = false,
  isOpen: controlledIsOpen,
  onOpen,
  onClose,
  onToggle,
  id: idProp,
}: UseDisclosureOptions = {}): UseDisclosureReturn {
  const [isOpenState, setIsOpen] = useState(defaultIsOpen);
  const id = useMemo(() => idProp ?? `disclosure-${Math.random().toString(36).slice(2)}`, [idProp]);
  
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : isOpenState;

  const callbacksRef = useRef({ onOpen, onClose, onToggle });
  callbacksRef.current = { onOpen, onClose, onToggle };

  const handleOpen = useCallback(() => {
    if (!isControlled) setIsOpen(true);
    callbacksRef.current.onOpen?.();
  }, [isControlled]);

  const handleClose = useCallback(() => {
    if (!isControlled) setIsOpen(false);
    callbacksRef.current.onClose?.();
  }, [isControlled]);

  const handleToggle = useCallback(() => {
    const next = !isOpen;
    if (!isControlled) setIsOpen(next);
    callbacksRef.current.onToggle?.(next);
    if (next) callbacksRef.current.onOpen?.();
    else callbacksRef.current.onClose?.();
  }, [isOpen, isControlled]);

  // ARIA-compatible button props
  const getButtonProps = useCallback((
    props: React.ButtonHTMLAttributes<HTMLButtonElement> = {}
  ) => ({
    ...props,
    'aria-expanded': isOpen,
    'aria-controls': id,
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      props.onClick?.(e);
      handleToggle();
    },
  }), [isOpen, id, handleToggle]);

  // Props for the disclosed element
  const getDisclosureProps = useCallback((
    props: React.HTMLAttributes<HTMLElement> = {}
  ) => ({
    ...props,
    id,
    hidden: !isOpen,
  }), [id, isOpen]);

  return {
    isOpen,
    onOpen: handleOpen,
    onClose: handleClose,
    onToggle: handleToggle,
    getButtonProps,
    getDisclosureProps,
  };
}

export { useDisclosure };
export type { UseDisclosureReturn };
```

## 25.3 Hook Code Review Checklist

```markdown
## Custom Hook Code Review — Senior Engineer Checklist

### Correctness
- [ ] All effect dependencies complete and correct (no suppressed warnings without comment)
- [ ] AbortController or cancellation token used for async effects
- [ ] Race condition impossible (request IDs, abort, ignore pattern)
- [ ] Cleanup returned from ALL useEffect calls that need it
- [ ] Stale closure impossible (functional updaters or ref pattern)
- [ ] Handles the case where the component unmounts mid-async

### API Design
- [ ] Options object, not positional args (3+ params)
- [ ] Stable function references (useCallback with correct deps)
- [ ] Returns `as const` for tuple return types
- [ ] Does NOT expose raw setState
- [ ] Controlled/uncontrolled pattern considered
- [ ] useDebugValue added for DevTools visibility

### TypeScript
- [ ] Fully typed inputs and outputs
- [ ] Generic constraints are tight (not `any`)
- [ ] Return type is exportable (ReturnType or explicit interface)
- [ ] No `as any` casts without comment

### Performance
- [ ] useMemo only for expensive operations or reference stability
- [ ] useCallback only when reference stability matters
- [ ] Does not cause unnecessary context consumer re-renders
- [ ] State is minimized (derived values computed, not stored)

### Testing
- [ ] Unit tests for all states (idle, loading, success, error)
- [ ] Async tests use waitFor, not arbitrary timeouts
- [ ] Cleanup/unmount behavior tested
- [ ] Edge cases covered (empty data, null inputs, boundary values)

### SSR Safety
- [ ] No window/document/navigator access outside useEffect or typeof guard
- [ ] Lazy initializers use SSR-safe defaults
- [ ] Works in Node.js environment (for testing)
```

---

# How Senior Engineers Think About Hooks

## The Five Senior-Level Questions

**1. Is this hook doing one thing?**  
The Single Responsibility Principle applies to hooks. If you can't name a hook in 2-3 words, it's doing too much.

**2. Who owns the state?**  
State should live at the lowest common ancestor of all components that need it. If only one component needs it → local state. Multiple components → lift to shared hook or store.

**3. What's the blast radius of a bug?**  
A hook used in 50 components that has a bug → 50 broken components. Mission-critical hooks need exhaustive tests and change control.

**4. What's the migration story?**  
How do you upgrade this hook when requirements change? If changing the hook API breaks 30 components → it was designed wrong. Additive changes only.

**5. Does this hook make testing harder or easier?**  
Good hooks separate concerns so components are easy to test with mocked hooks. If your hook is hard to mock → it's doing too much or has hidden dependencies.

## How Hooks Fail in Production

```
1. Memory leaks: Effects that don't clean up (timers, subscriptions)
2. Stale closures: Effects reading state from render N-1
3. Race conditions: Concurrent requests overwriting each other
4. Infinite loops: Object/array deps creating new references each render
5. Thundering herd: 20 components each fetching the same data
6. Context hell: Deeply nested providers causing full-tree re-renders
7. SSR mismatch: Browser-specific code running on server
8. Unmounted state updates: Async callbacks calling setState after unmount
```

## How to Avoid Overengineering Hooks

```typescript
// ❌ OVERENGINEERED: Premature abstraction
function useButtonClick<
  T extends HTMLButtonElement = HTMLButtonElement,
  E extends React.MouseEvent<T> = React.MouseEvent<T>
>(handler: (event: E) => void, options?: UseButtonClickOptions<T>): UseButtonClickReturn<T> {
  // 50 lines for something that should be 1 line
}

// ✅ RIGHT SIZE: Abstract when you have 3+ real use cases
// Start with inline code → see the pattern → extract
// Don't extract speculatively

// Rule of Three: extract to a hook only after the third duplication
```

---

## Final Project: Build a SaaS Dashboard Feature

**Scenario**: You're building a real-time analytics dashboard for a SaaS product. Requirements:

1. **Data**: Fetch metrics every 30 seconds, show stale data while refreshing
2. **Filters**: Date range, user segments — URL-synced, shareable
3. **Real-time**: WebSocket for live event counts
4. **Permissions**: Admins see all data; members see only their own
5. **Offline**: Cache last-seen data, show offline indicator
6. **Export**: Download CSV (mutation), with progress tracking

**Compose these hooks**:
```typescript
function AnalyticsDashboard() {
  const { can } = usePermissions();
  const { isOnline } = useOnlineStatus();
  const [dateRange, setDateRange] = useURLParam({ key: 'range', defaultValue: '7d' });
  
  const metrics = usePolling({
    fetcher: () => analyticsService.getMetrics({ dateRange, adminView: can('analytics:all') }),
    interval: 30_000,
  });
  
  const liveEvents = useWebSocket<LiveEvent>({
    url: `wss://analytics.company.com/live`,
    enabled: isOnline,
  });
  
  const exportCSV = useMutation({
    mutationFn: () => analyticsService.export({ dateRange }),
    onSuccess: (blob) => downloadFile(blob, 'analytics.csv'),
  });
  
  return (
    <DashboardLayout offline={!isOnline}>
      <DateRangeFilter value={dateRange} onChange={setDateRange} />
      <MetricsGrid data={metrics.data} isStale={metrics.isLoading} />
      <LiveEventFeed events={liveEvents.lastMessage} />
      <ExportButton loading={exportCSV.isLoading} onClick={() => exportCSV.mutate()} />
    </DashboardLayout>
  );
}
```

**FAANG-Level Analysis**: At Stripe/Shopify scale, the analytics service itself is a separate microservice with its own SLA. The WebSocket connection goes through an API Gateway with connection multiplexing. Feature flags control rollout of new chart types. The hooks above are unchanged — they're implementation-agnostic. That's the sign of a well-architected hook layer: the infrastructure can change without touching the React code.

---

## Quick Reference: The Hook Decision Tree

```
Need to share logic across components?
├─ YES → Is it React state/effects?
│        ├─ YES → Custom hook
│        └─ NO  → Utility function / service
└─ NO  → Inline in component

What should the hook do?
├─ Fetch data              → useQuery pattern + useFetch
├─ Write data              → useMutation pattern
├─ Browser API             → Wrap in useEffect + cleanup
├─ Shared state across tree → Context + useContext
├─ Global state (no tree)  → Zustand/Jotai store hook
└─ Derived from state      → useMemo (or compute inline)

Where should state live?
├─ One component           → useState in component
├─ Sibling components      → Lift to parent, or shared hook
├─ Cousin components       → Context or store
└─ Entire app              → Global store (Zustand)

Is my hook doing too much?
├─ > 100 lines             → Split by concern
├─ > 3 useEffects          → Probably too much
├─ Hard to name            → Too many responsibilities
└─ Hard to test in isolation → Hidden dependencies to extract
```

---

*This completes the three-volume curriculum. You now have the architecture, patterns, and judgment to design production-grade hooks at any scale — from a weekend side project to a FAANG-scale frontend.*
