# ⚛️ Mastering Custom Hooks in React + TypeScript
## Elite Frontend Engineering Curriculum — Volume 1: Fundamentals → Advanced

> *"A senior engineer doesn't just know how to use hooks. They know why the rules exist, how the runtime enforces them, and how to design hook APIs that scale to 50 engineers and 500 components."*

---

## TABLE OF CONTENTS

### Volume 1 (This Document)
1. [What Custom Hooks Really Are Internally](#1-what-custom-hooks-really-are-internally)
2. [Rules of Hooks — The Deep Why](#2-rules-of-hooks--the-deep-why)
3. [State Encapsulation](#3-state-encapsulation)
4. [Logic Reuse and Separation of Concerns](#4-logic-reuse-and-separation-of-concerns)
5. [Hook Composition](#5-hook-composition)
6. [Designing Reusable Hook APIs](#6-designing-reusable-hook-apis)
7. [Async Hooks and Data Fetching](#7-async-hooks-and-data-fetching)
8. [Mutation Hooks](#8-mutation-hooks)
9. [Caching, Optimistic Updates, Retry](#9-caching-optimistic-updates-retry)
10. [Pagination and Infinite Scroll Hooks](#10-pagination-and-infinite-scroll-hooks)

### Volume 2 (See react-hooks-mastery-vol2.md)
11. Debounce/Throttle Hooks
12. Form and Validation Hooks
13. Auth and Permission Hooks
14. Browser API Hooks (Storage, URL, Media, Events)
15. Observer and Animation Hooks
16. WebSocket, Polling, Real-time Hooks
17. Offline-First and Error Boundary Hooks
18. Analytics and Accessibility Hooks

### Volume 3 (See react-hooks-mastery-vol3.md)
19. Performance Deep Dive (stale closures, race conditions, memoization)
20. Testing Strategies
21. Hook Architecture for Enterprise
22. SSR/Next.js/RSC Considerations
23. Hooks with State Management (Zustand, Jotai, Redux)
24. Production Case Studies
25. Build a Production Hook Library from Scratch

---

# 1. What Custom Hooks Really Are Internally

## 1.1 Mental Model

> **Mental Model**: Think of React's hook system as a **linked list of slots** attached to each component instance. Every time your component renders, React walks this list in order, assigning each `useState`, `useEffect`, etc. to its corresponding slot. A custom hook is simply a **named grouping** of these calls — it doesn't create new slots of its own.

**Real-World Analogy**: Imagine a hotel. Each room (component) has a row of numbered safes (slots). When you check in (render), the front desk assigns items to those safes in order. A "custom hook" is like a concierge package — it internally uses several of your safes, but from your perspective it's one transaction. The hotel doesn't know about the package; it just sees individual safe assignments.

## 1.2 How React Tracks Hooks Internally

React maintains a **fiber node** for each component. That fiber has a `memoizedState` property — a singly linked list of hook state objects:

```
FiberNode {
  memoizedState: HookState → HookState → HookState → null
                 (useState)   (useEffect)  (useRef)
}
```

Each `HookState` node looks roughly like:

```typescript
interface HookState<S> {
  memoizedState: S;         // The current state value
  baseState: S;             // State before updates
  queue: UpdateQueue<S>;    // Pending updates
  baseQueue: Update<S> | null;
  next: HookState<any> | null; // Pointer to next hook
}
```

React uses a **cursor** (`currentHook`) that advances on every hook call. This is why order matters — React identifies `useState` calls by their *position*, not their name.

## 1.3 The Difference Between a Function and a Custom Hook

```typescript
// ❌ Just a function — no hooks, no magic
function getWindowWidth(): number {
  return window.innerWidth; // Static value, no reactivity
}

// ✅ A custom hook — uses React hooks internally
function useWindowWidth(): number {
  const [width, setWidth] = useState<number>(window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return width;
}
```

**The naming convention `use*` is not just style** — ESLint's `react-hooks` plugin uses it to know *which functions to apply hook rules to*. If you name it `getWindowWidth`, the linter won't warn you when you violate hook rules inside it.

## 1.4 Minimal Working Example — Dissected

```typescript
// hooks/useCounter.ts
import { useState, useCallback } from 'react';

interface UseCounterOptions {
  initialValue?: number;
  min?: number;
  max?: number;
  step?: number;
}

interface UseCounterReturn {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  set: (value: number) => void;
}

export function useCounter({
  initialValue = 0,
  min = -Infinity,
  max = Infinity,
  step = 1,
}: UseCounterOptions = {}): UseCounterReturn {
  // Hook slot #1: useState
  const [count, setCount] = useState<number>(initialValue);

  // useCallback stabilizes function references — prevents child rerenders
  const increment = useCallback(() => {
    setCount(prev => Math.min(prev + step, max));
  }, [step, max]);

  const decrement = useCallback(() => {
    setCount(prev => Math.max(prev - step, min));
  }, [step, min]);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  const set = useCallback((value: number) => {
    setCount(Math.min(Math.max(value, min), max));
  }, [min, max]);

  return { count, increment, decrement, reset, set };
}
```

```tsx
// Usage
function CounterDemo() {
  const { count, increment, decrement, reset } = useCounter({
    initialValue: 10,
    min: 0,
    max: 100,
    step: 5,
  });

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={decrement}>-5</button>
      <button onClick={increment}>+5</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

## 1.5 Production-Grade Version

Notice how the simple version has a subtle bug: if `initialValue` changes after mount, `reset` will use the stale value (the original one), which is actually intentional behavior — but should be explicit:

```typescript
// hooks/useCounter.ts (production version)
import { useState, useCallback, useRef } from 'react';

interface UseCounterOptions {
  initialValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void; // Controlled mode support
}

export function useCounter({
  initialValue = 0,
  min = -Infinity,
  max = Infinity,
  step = 1,
  onChange,
}: UseCounterOptions = {}) {
  const [count, setCount] = useState<number>(() => {
    // Lazy initializer: runs once, avoids recomputing on every render
    const clamped = Math.min(Math.max(initialValue, min), max);
    return clamped;
  });

  // Use ref to capture the latest onChange without making it a dependency
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Capture initialValue at mount time for stable reset
  const initialValueRef = useRef(initialValue);

  const clamp = useCallback(
    (value: number) => Math.min(Math.max(value, min), max),
    [min, max]
  );

  const updateCount = useCallback((updater: (prev: number) => number) => {
    setCount(prev => {
      const next = clamp(updater(prev));
      // Notify without stale closure on onChange
      onChangeRef.current?.(next);
      return next;
    });
  }, [clamp]);

  const increment = useCallback(() => {
    updateCount(prev => prev + step);
  }, [updateCount, step]);

  const decrement = useCallback(() => {
    updateCount(prev => prev - step);
  }, [updateCount, step]);

  const reset = useCallback(() => {
    updateCount(() => initialValueRef.current);
  }, [updateCount]);

  const set = useCallback((value: number) => {
    updateCount(() => value);
  }, [updateCount]);

  return { count, increment, decrement, reset, set } as const;
}
```

## 1.6 Common Mistakes

```typescript
// ❌ MISTAKE 1: Returning unstable references
function useBadCounter() {
  const [count, setCount] = useState(0);
  
  // New function object created every render → breaks memo'd children
  const increment = () => setCount(c => c + 1);
  
  return { count, increment };
}

// ✅ FIX: Stabilize with useCallback
function useGoodCounter() {
  const [count, setCount] = useState(0);
  const increment = useCallback(() => setCount(c => c + 1), []);
  return { count, increment };
}

// ❌ MISTAKE 2: Exposing setState directly
function useBadState() {
  const [value, setValue] = useState('');
  return { value, setValue }; // Caller can do anything — no validation
}

// ✅ FIX: Expose controlled setters
function useGoodState(validator?: (v: string) => boolean) {
  const [value, setValue] = useState('');
  const update = useCallback((next: string) => {
    if (!validator || validator(next)) {
      setValue(next);
    }
  }, [validator]);
  return { value, update };
}

// ❌ MISTAKE 3: Not cleaning up effects
function useBadTimer() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setInterval(() => setTick(t => t + 1), 1000); // Memory leak!
  }, []);
  return tick;
}

// ✅ FIX: Always return cleanup
function useGoodTimer() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id); // Cleanup
  }, []);
  return tick;
}
```

## 1.7 Debugging Strategies

```typescript
// 1. Use React DevTools — hooks show in component tree with their values

// 2. Add a debug label for useDebugValue
import { useDebugValue } from 'react';

function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  
  // Shows in React DevTools as "Auth: logged in as bruce@example.com"
  useDebugValue(user, u => u ? `logged in as ${u.email}` : 'anonymous');
  
  return { user };
}

// 3. Wrap in a logging hook during development
function useLogged<T>(hookResult: T, name: string): T {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${name}]`, hookResult);
  }
  return hookResult;
}

// Usage: const result = useLogged(useCounter(), 'useCounter');

// 4. Track render counts
function useRenderCount(label: string) {
  const count = useRef(0);
  count.current++;
  if (process.env.NODE_ENV === 'development') {
    console.log(`${label} rendered ${count.current} times`);
  }
}
```

## 1.8 Performance Considerations

- **Every hook call has overhead** (array traversal + pointer following). This is nanoseconds — not your bottleneck.
- **The real cost is re-renders triggered by state changes** inside hooks. Design state granularity carefully.
- **Stable references from `useCallback`/`useMemo`** prevent child component re-renders and effect re-runs.
- **Prefer state updater functions** (`setCount(prev => prev + 1)`) over direct values to avoid stale closures.

## 1.9 Interview-Level Insights

> **Q: Why can't you call hooks conditionally?**

React tracks hooks by *call order*. If on render #1 you call `useState`, `useEffect`, `useState` (slots 0, 1, 2), but on render #2 you skip the middle one conditionally, the third `useState` now occupies slot 1 instead of slot 2. React reads the wrong state. The linked list is out of sync.

> **Q: What makes a function a hook vs a utility function?**

If it calls any React hook internally (including other custom hooks), it MUST follow hook rules and MUST be prefixed with `use`. Otherwise it's a plain function and should NOT use the prefix.

> **Q: Can two components share state via a shared custom hook?**

NO — unless the state lives in a shared external store (Context, Zustand, etc.). Each component that calls a hook gets its own *instance* of that hook's state. This is a key architectural insight.

---

## Section 1 Exercises

**Exercise 1.1** — Basic: Implement `useBoolean()` with `toggle`, `setTrue`, `setFalse`, `value`. Add TypeScript types.

**Exercise 1.2** — Intermediate: Extend `useCounter` to support history (undo/redo). Design the API first, then implement.

**Exercise 1.3** — Advanced: Implement a `useControllable<T>` hook that can operate in both controlled mode (value passed from parent) and uncontrolled mode (internal state). This pattern is used in all major component libraries.

**Refactoring Task**: Take this bad code and refactor it into a custom hook:
```tsx
function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    setLoading(true);
    fetch('/api/user')
      .then(r => r.json())
      .then(data => { setUser(data); setLoading(false); })
      .catch(err => { setError(err); setLoading(false); });
  }, []);
  
  // ... 200 more lines of component
}
```

**What Would Break in Production?**
- The `useCounter` example above: what happens if `min > max`? Write a guard.
- What if `initialValue` is `NaN`? Add validation.
- What if two `useCounter` hooks in sibling components need to share state? Explain the architectural solution.

---

# 2. Rules of Hooks — The Deep Why

## 2.1 The Two Rules

**Rule 1**: Only call hooks at the top level.  
**Rule 2**: Only call hooks from React function components or custom hooks.

These aren't arbitrary — they're **requirements of the linked-list implementation**.

## 2.2 Why Rule 1 Exists — Deep Dive

```typescript
// ❌ This will corrupt React's hook state
function useBroken(condition: boolean) {
  if (condition) {
    const [value, setValue] = useState(0); // Only sometimes slot #0
  }
  const [other, setOther] = useState(''); // Sometimes slot #0, sometimes slot #1
  // React reads the wrong data on condition change
}

// The linked list on first render (condition=true):
// [0: useState(0)] → [1: useState('')]

// The linked list on second render (condition=false):
// React tries to read slot #0 for 'other' but finds the number state!
// CATASTROPHIC: wrong state for wrong variable
```

## 2.3 Why Rule 2 Exists

Hooks *modify* React's fiber. This machinery only works inside React's reconciler lifecycle. Calling `useState` from a plain function, a class component, or an async callback that runs *outside* React's rendering pipeline would access undefined or wrong fiber state.

```typescript
// ❌ Can't call hooks in class components
class Bad extends React.Component {
  render() {
    const [x] = useState(0); // Throws: hooks can only be called in function components
    return <div>{x}</div>;
  }
}

// ❌ Can't call hooks in event handlers (if not already in a hook/component)
document.addEventListener('click', () => {
  const [x] = useState(0); // Throws — no fiber context
});

// ✅ In a custom hook called from a component — fine
function useDocumentClick(handler: () => void) {
  useEffect(() => {
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [handler]);
}
```

## 2.4 The `react-hooks` ESLint Plugin — What It Catches

```typescript
// Linter catches: exhaustive-deps violations
function useData(id: string) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch(`/api/${id}`).then(r => r.json()).then(setData);
    // ❌ ESLint: 'id' used but not in deps array
  }, []); // Missing 'id'
  
  return data;
}

// ✅ Correct
function useData(id: string) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch(`/api/${id}`).then(r => r.json()).then(setData);
  }, [id]); // ✅ id included
  
  return data;
}
```

## 2.5 Loops — A Subtle Rules Violation

```typescript
// ❌ FORBIDDEN: Hooks in loops
function useAllUsers(ids: string[]) {
  return ids.map(id => {
    const [user] = useState(null); // Different number of hooks on each render!
    return user;
  });
}

// ✅ CORRECT: Single state for all users
function useAllUsers(ids: string[]) {
  const [users, setUsers] = useState<Record<string, User>>({});
  
  useEffect(() => {
    Promise.all(
      ids.map(id => fetch(`/api/users/${id}`).then(r => r.json()))
    ).then(results => {
      const byId = Object.fromEntries(ids.map((id, i) => [id, results[i]]));
      setUsers(byId);
    });
  }, [ids.join(',')]); // Stable string dep for array
  
  return ids.map(id => users[id]);
}
```

## 2.6 The `eslint-disable` Trap — When NOT to Suppress

```typescript
// ❌ DANGEROUS: Suppressing exhaustive-deps to "fix" a bug
useEffect(() => {
  fetchUser(userId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // "I only want this to run once"

// The real problem: you're fighting the rules to implement a pattern
// The fix: use an initialization ref pattern
const initialized = useRef(false);
useEffect(() => {
  if (!initialized.current) {
    initialized.current = true;
    fetchUser(userId);
  }
}, [userId]); // Now correct AND runs once per userId

// OR: Use the lazy initializer pattern with useState
const [data] = useState(() => expensiveComputation()); // Runs once
```

## 2.7 Interview-Level Insights

> **Q: If `useMemo` has no deps array, what happens?**

It runs on every render — equivalent to not using it at all. An empty array `[]` runs once. Missing array means "always recompute."

> **Q: Can you call a custom hook from another custom hook?**

Yes, and this is the primary composition mechanism. The inner hook's calls register in the calling component's fiber, not in some "hook component."

> **Q: What is `react-hooks/rules-of-hooks` rule vs `react-hooks/exhaustive-deps`?**

`rules-of-hooks` enforces the two rules (top level, function components only). `exhaustive-deps` enforces that all reactive values used inside `useEffect`, `useMemo`, `useCallback` are listed in dependencies — a separate (but critical) correctness concern.

---

# 3. State Encapsulation

## 3.1 Mental Model

> **Mental Model**: A hook with encapsulated state is a **private vault**. The component sees only what the hook exposes. Internals can change without affecting the component API.

**Real-World Analogy**: An ATM machine. You interact through a defined interface (deposit, withdraw, check balance). The internal banking system can be refactored, migrated, or audited without changing how you use the ATM.

## 3.2 Why Encapsulation Matters

```typescript
// ❌ BAD: Component owns all state — unscalable
function ShoppingCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  
  // 50 lines of cart logic mixed with rendering...
  
  const addItem = (item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id 
          ? { ...i, quantity: i.quantity + 1 } 
          : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    // Recalculate total...
    setTotal(/*...*/);
  };
  
  return <div>{/* 100 lines of JSX */}</div>;
}
```

```typescript
// ✅ GOOD: Logic encapsulated in hooks
function ShoppingCart() {
  const cart = useCart();
  const { apply: applyCoupon, discount } = useCoupon();
  
  return (
    <div>
      <CartItemList items={cart.items} onRemove={cart.removeItem} />
      <CouponInput onApply={applyCoupon} discount={discount} />
      <CartTotal subtotal={cart.subtotal} discount={discount} />
      <CheckoutButton
        disabled={cart.isEmpty}
        onCheckout={() => cart.checkout(discount)}
      />
    </div>
  );
}
```

## 3.3 Building useCart — Full Encapsulated State

```typescript
// types/cart.ts
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface CartState {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  isEmpty: boolean;
}

// hooks/useCart.ts
import { useCallback, useMemo, useReducer } from 'react';
import type { CartItem } from '../types/cart';

// ──── Types ────────────────────────────────────────────────
type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'quantity'> }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR' };

interface CartState {
  items: CartItem[];
}

// ──── Reducer (pure function — easily testable) ──────────
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, { ...action.payload, quantity: 1 }],
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(i => i.id !== action.payload.id),
      };
    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(i => i.id !== action.payload.id),
        };
      }
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };
    }
    case 'CLEAR':
      return { items: [] };
    default:
      return state;
  }
}

// ──── Hook ────────────────────────────────────────────────
export function useCart() {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Derived state — memoized to prevent recalculation
  const subtotal = useMemo(
    () => state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [state.items]
  );

  const itemCount = useMemo(
    () => state.items.reduce((sum, item) => sum + item.quantity, 0),
    [state.items]
  );

  // Stable action creators
  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'>) =>
      dispatch({ type: 'ADD_ITEM', payload: item }),
    []
  );

  const removeItem = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_ITEM', payload: { id } }),
    []
  );

  const updateQuantity = useCallback(
    (id: string, quantity: number) =>
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } }),
    []
  );

  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  return {
    // State (read-only view)
    items: state.items,
    subtotal,
    itemCount,
    isEmpty: state.items.length === 0,
    // Actions
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  } as const;
}

export type UseCartReturn = ReturnType<typeof useCart>;
```

## 3.4 Encapsulation Levels

```typescript
// Level 1: State only
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn(v => !v), []);
  return [on, toggle] as const;
}

// Level 2: State + derived state
function useSearch<T>(items: T[], searchFn: (item: T, query: string) => boolean) {
  const [query, setQuery] = useState('');
  const results = useMemo(
    () => query ? items.filter(item => searchFn(item, query)) : items,
    [items, query, searchFn]
  );
  return { query, setQuery, results, hasQuery: query.length > 0 };
}

// Level 3: State + async side effects
function useUserData(userId: string) {
  const [data, setData] = useState<User | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) return;
    
    const controller = new AbortController();
    setStatus('loading');
    
    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(user => {
        setData(user);
        setStatus('success');
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err);
        setStatus('error');
      });
    
    return () => controller.abort();
  }, [userId]);

  return { data, status, error, isLoading: status === 'loading' };
}

// Level 4: State + persistence + sync
function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof value === 'function' ? (value as Function)(prev) : value;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        console.warn('Failed to persist state');
      }
      return next;
    });
  }, [key]);

  return [state, setPersistedState] as const;
}
```

## 3.5 The `useReducer` vs `useState` Decision

```typescript
// Use useState when:
// - Single value
// - Updates are independent
const [isOpen, setIsOpen] = useState(false);

// Use useReducer when:
// - Multiple related state values
// - Next state depends on multiple previous values
// - Complex update logic
// - You want a testable pure function for updates
// - State machine semantics

type ModalState = 
  | { status: 'closed' }
  | { status: 'opening' }
  | { status: 'open'; data: unknown }
  | { status: 'closing' };

type ModalAction = 
  | { type: 'OPEN'; data: unknown }
  | { type: 'ANIMATION_COMPLETE' }
  | { type: 'CLOSE' };

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN':
      return state.status === 'closed' 
        ? { status: 'opening' } 
        : state;
    case 'ANIMATION_COMPLETE':
      return state.status === 'opening'
        ? { status: 'open', data: action.data ?? null }
        : state.status === 'closing'
        ? { status: 'closed' }
        : state;
    case 'CLOSE':
      return state.status === 'open' 
        ? { status: 'closing' } 
        : state;
    default:
      return state;
  }
}

function useModal() {
  const [state, dispatch] = useReducer(modalReducer, { status: 'closed' });
  
  return {
    isOpen: state.status === 'open' || state.status === 'opening',
    isAnimating: state.status === 'opening' || state.status === 'closing',
    data: state.status === 'open' ? state.data : null,
    open: (data: unknown) => dispatch({ type: 'OPEN', data }),
    close: () => dispatch({ type: 'CLOSE' }),
    onAnimationComplete: () => dispatch({ type: 'ANIMATION_COMPLETE' }),
  };
}
```

---

# 4. Logic Reuse and Separation of Concerns

## 4.1 Mental Model

> **Mental Model**: Think of concerns as **layers in a kitchen**. The chef (component) should only be plating food. Prep (data fetching), cooking (business logic), and pantry management (state) belong in separate stations. Custom hooks are those stations.

## 4.2 The Concern Stack

```
┌─────────────────────────────────────┐
│         UI Layer (JSX)              │  ← What renders
├─────────────────────────────────────┤
│     Presentation Logic Hooks        │  ← What shows (formatting, derived UI state)
├─────────────────────────────────────┤
│     Business Logic Hooks            │  ← What happens (domain rules)
├─────────────────────────────────────┤
│     Data Fetching Hooks             │  ← Where data comes from
├─────────────────────────────────────┤
│     Infrastructure Hooks            │  ← Browser APIs, storage, network
└─────────────────────────────────────┘
```

## 4.3 Real Example — E-Commerce Product Page

**Before (everything coupled):**
```tsx
// ❌ 200-line component with everything mixed
function ProductPage({ productId }: { productId: string }) {
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [inWishlist, setInWishlist] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const user = useContext(AuthContext);
  
  useEffect(() => {
    Promise.all([
      fetch(`/api/products/${productId}`).then(r => r.json()),
      fetch(`/api/products/${productId}/reviews`).then(r => r.json()),
    ]).then(([prod, revs]) => {
      setProduct(prod);
      setReviews(revs);
      setSelectedVariant(prod.variants[0]);
      setLoading(false);
    });
  }, [productId]);
  
  const addToCart = async () => {
    setCartLoading(true);
    await fetch('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, variantId: selectedVariant.id, quantity }),
    });
    setCartLoading(false);
  };
  
  // ... 150 more lines
}
```

**After (separation of concerns):**
```tsx
// ✅ Clean component — only orchestration
function ProductPage({ productId }: { productId: string }) {
  const { product, isLoading } = useProduct(productId);
  const { reviews, averageRating } = useProductReviews(productId);
  const { selectedVariant, selectVariant } = useVariantSelector(product?.variants);
  const { quantity, increment, decrement } = useCounter({ min: 1, max: 99 });
  const { isInWishlist, toggle: toggleWishlist } = useWishlist(productId);
  const { addToCart, isAdding } = useAddToCart();

  if (isLoading) return <ProductSkeleton />;
  if (!product) return <NotFound />;

  return (
    <ProductLayout>
      <ProductImages images={product.images} />
      <ProductInfo product={product} rating={averageRating} />
      <VariantPicker variants={product.variants} selected={selectedVariant} onSelect={selectVariant} />
      <QuantitySelector value={quantity} onIncrement={increment} onDecrement={decrement} />
      <AddToCartButton
        loading={isAdding}
        onClick={() => addToCart({ productId, variantId: selectedVariant?.id, quantity })}
      />
      <WishlistButton active={isInWishlist} onClick={toggleWishlist} />
      <ReviewSection reviews={reviews} />
    </ProductLayout>
  );
}
```

## 4.4 Domain-Driven Hook Structure

```
src/
├── hooks/
│   ├── domain/
│   │   ├── cart/
│   │   │   ├── useCart.ts
│   │   │   ├── useAddToCart.ts
│   │   │   ├── useCartSummary.ts
│   │   │   └── index.ts
│   │   ├── products/
│   │   │   ├── useProduct.ts
│   │   │   ├── useProductList.ts
│   │   │   ├── useProductSearch.ts
│   │   │   └── useVariantSelector.ts
│   │   ├── auth/
│   │   │   ├── useAuth.ts
│   │   │   ├── usePermissions.ts
│   │   │   └── useSession.ts
│   │   └── user/
│   │       ├── useProfile.ts
│   │       ├── useWishlist.ts
│   │       └── useOrderHistory.ts
│   ├── ui/
│   │   ├── useModal.ts
│   │   ├── useToast.ts
│   │   ├── useDrawer.ts
│   │   └── useDropdown.ts
│   ├── browser/
│   │   ├── useLocalStorage.ts
│   │   ├── useMediaQuery.ts
│   │   ├── useIntersectionObserver.ts
│   │   └── useEventListener.ts
│   └── utils/
│       ├── useDebounce.ts
│       ├── useThrottle.ts
│       ├── usePrevious.ts
│       └── useStableCallback.ts
```

## 4.5 Interview-Level Insight

> **Q: How do you decide what belongs in a hook vs a utility function vs a service?**

- **Utility function**: Pure computation, no React state/effects. `formatPrice(amount)`, `validateEmail(str)`.
- **Service**: API communication layer, no React concepts. `ProductService.getById(id)`.
- **Hook**: Bridges React's lifecycle to services/utilities. Manages state, effects, subscriptions.

The hook should be a *thin orchestration layer*. Heavy computation belongs in utilities; API calls belong in services; the hook just glues them to React's lifecycle.

---

# 5. Hook Composition

## 5.1 Mental Model

> **Mental Model**: Custom hooks compose like **LEGO bricks**. Small, single-purpose hooks snap together to build complex behavior. The composition itself lives in a higher-level hook.

## 5.2 Composition Levels

```typescript
// ──── Level 1: Primitive hooks ────────────────────────────
function useBoolean(initial = false) {
  const [value, setValue] = useState(initial);
  return {
    value,
    setTrue: useCallback(() => setValue(true), []),
    setFalse: useCallback(() => setValue(false), []),
    toggle: useCallback(() => setValue(v => !v), []),
  };
}

function useAsync<T>(fn: () => Promise<T>) {
  const [state, setState] = useState<{
    data: T | null;
    error: Error | null;
    status: 'idle' | 'loading' | 'success' | 'error';
  }>({ data: null, error: null, status: 'idle' });

  const execute = useCallback(async () => {
    setState({ data: null, error: null, status: 'loading' });
    try {
      const data = await fn();
      setState({ data, error: null, status: 'success' });
    } catch (error) {
      setState({ data: null, error: error as Error, status: 'error' });
    }
  }, [fn]);

  return { ...state, execute, isLoading: state.status === 'loading' };
}

// ──── Level 2: Composed hooks ─────────────────────────────
function useToggleWithConfirmation(onConfirm: () => Promise<void>) {
  const toggle = useBoolean(false);
  const confirm = useAsync(onConfirm);
  
  const handleToggle = useCallback(async () => {
    await confirm.execute();
    if (!confirm.error) {
      toggle.toggle();
    }
  }, [confirm, toggle]);
  
  return {
    isOn: toggle.value,
    isConfirming: confirm.isLoading,
    confirmError: confirm.error,
    toggle: handleToggle,
  };
}

// ──── Level 3: Feature hooks (compose multiple Level 2) ───
function useFeatureToggle(featureId: string) {
  const { data: config } = useFetch<FeatureConfig>(`/api/features/${featureId}`);
  const persistedState = useLocalStorage(`feature:${featureId}`, false);
  const { hasPermission } = usePermissions();
  
  const toggle = useToggleWithConfirmation(async () => {
    await fetch(`/api/features/${featureId}/toggle`, { method: 'POST' });
  });
  
  const canToggle = hasPermission('manage:features') && config?.isToggleable;
  
  return {
    isEnabled: persistedState[0],
    canToggle,
    toggle: canToggle ? toggle.toggle : undefined,
    isToggling: toggle.isConfirming,
  };
}
```

## 5.3 The Composable Data Hook Pattern

```typescript
// ──── Base: useResource ───────────────────────────────────
interface UseResourceOptions<T> {
  fetcher: () => Promise<T>;
  deps?: unknown[];
  enabled?: boolean;
}

function useResource<T>({ fetcher, deps = [], enabled = true }: UseResourceOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;
    
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    
    fetcherRef.current()
      .then(result => {
        if (!controller.signal.aborted) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted && err.name !== 'AbortError') {
          setError(err);
          setIsLoading(false);
        }
      });
    
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, error, isLoading };
}

// ──── Built on top of useResource ────────────────────────
function useUser(userId: string) {
  return useResource({
    fetcher: () => userService.getById(userId),
    deps: [userId],
    enabled: Boolean(userId),
  });
}

function useUserOrders(userId: string, page: number) {
  return useResource({
    fetcher: () => orderService.getByUser(userId, page),
    deps: [userId, page],
    enabled: Boolean(userId),
  });
}
```

## 5.4 Composing with Context for Shared State

```typescript
// When multiple components need the SAME state from a hook:

// Create a context
const CartContext = createContext<UseCartReturn | null>(null);

// Provider wraps the tree
function CartProvider({ children }: { children: React.ReactNode }) {
  const cart = useCart(); // State lives HERE, shared by all consumers
  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

// Consumer hook — clean API, throws if used outside provider
function useCartContext(): UseCartReturn {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCartContext must be used within CartProvider');
  }
  return context;
}

// Now any component can use the SHARED cart
function CartIcon() {
  const { itemCount } = useCartContext();
  return <span>{itemCount}</span>;
}

function CartPage() {
  const { items, removeItem, subtotal } = useCartContext();
  return (/* ... */);
}
```

## 5.5 Anti-Pattern: Over-Composition

```typescript
// ❌ TOO GRANULAR: Hooks so small they add overhead without benefit
function useIsTrue(value: boolean) { return value === true; }
function useStringLength(s: string) { return s.length; }
function useAddOne(n: number) { return n + 1; }

// ✅ RIGHT LEVEL: Hooks encapsulate meaningful units of behavior
// A good rule: "Would I want to test this in isolation?"
// "Would I reuse this across 3+ components?"
// If yes to both → make a hook. Otherwise → inline it.
```

---

# 6. Designing Reusable Hook APIs

## 6.1 Mental Model

> **Mental Model**: A hook's API is a **contract with future users** (including yourself in 6 months). Design it like a public library — backwards compatible, well-typed, documented, and ergonomic.

**Real-World Analogy**: The `fetch` API. Simple to use for basic cases (`fetch(url)`), but supports complexity when needed (`fetch(url, { method, headers, body })`). Your hooks should follow the same progressive disclosure principle.

## 6.2 API Design Principles

```typescript
// Principle 1: Options object for extensibility
// ❌ Positional args — hard to extend without breaking changes
function useFetch(url: string, method: string, headers: Record<string, string>) {}

// ✅ Options object — can add fields without breaking callers
interface UseFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  enabled?: boolean;
  retry?: number;
}
function useFetch<T>(url: string, options?: UseFetchOptions) {}

// Principle 2: Consistent return shape
// ❌ Inconsistent — sometimes array, sometimes object
function useA() { return [value, setter] as const; }
function useB() { return { value, setter }; }

// ✅ Objects for hooks returning 3+ values (named = clearer)
// ✅ Tuples [value, setter] for hooks following useState pattern

// Principle 3: Never return raw setState
// ❌ 
function useFilter() {
  const [filter, setFilter] = useState<Filter>({});
  return { filter, setFilter }; // Caller can set ANY value — no validation
}
// ✅
function useFilter() {
  const [filter, setFilter] = useState<Filter>({});
  const updateFilter = useCallback((updates: Partial<Filter>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  }, []);
  const resetFilter = useCallback(() => setFilter({}), []);
  return { filter, updateFilter, resetFilter };
}
```

## 6.3 The Options Pattern with Overloads

```typescript
// Overloads for different call signatures
function usePagination(totalItems: number): UsePaginationReturn;
function usePagination(options: UsePaginationOptions): UsePaginationReturn;
function usePagination(
  arg: number | UsePaginationOptions
): UsePaginationReturn {
  const options: UsePaginationOptions = typeof arg === 'number'
    ? { totalItems: arg }
    : arg;
  
  const {
    totalItems,
    pageSize = 10,
    initialPage = 1,
    onChange,
  } = options;
  
  const [currentPage, setCurrentPage] = useState(initialPage);
  
  const totalPages = Math.ceil(totalItems / pageSize);
  
  const goToPage = useCallback((page: number) => {
    const clamped = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(clamped);
    onChange?.(clamped);
  }, [totalPages, onChange]);
  
  return {
    currentPage,
    totalPages,
    pageSize,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    goToPage,
    nextPage: () => goToPage(currentPage + 1),
    prevPage: () => goToPage(currentPage - 1),
    firstPage: () => goToPage(1),
    lastPage: () => goToPage(totalPages),
    startIndex: (currentPage - 1) * pageSize,
    endIndex: Math.min(currentPage * pageSize - 1, totalItems - 1),
  };
}

interface UsePaginationOptions {
  totalItems: number;
  pageSize?: number;
  initialPage?: number;
  onChange?: (page: number) => void;
}
```

## 6.4 Ref-Based Stable Callbacks — The useStableCallback Pattern

```typescript
// Problem: useCallback dependencies cause stale closures OR
// force consumers to memoize their callbacks (leaky abstraction)

// ✅ The useStableCallback pattern (React's upcoming useEvent)
function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const fnRef = useRef<T>(fn);
  
  // Always update to latest — no stale closure
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  
  // Stable reference — never changes
  return useCallback((...args: Parameters<T>) => {
    return fnRef.current(...args);
  }, []) as T;
}

// Usage: callbacks that need to be stable but always have fresh values
function useInterval(callback: () => void, delay: number | null) {
  const stableCallback = useStableCallback(callback);
  
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(stableCallback, delay);
    return () => clearInterval(id);
  }, [delay, stableCallback]); // stableCallback never changes — ✅
}
```

## 6.5 How Senior Engineers Think About Hook API Design

> 1. **Start with the usage** — write the component using the hook BEFORE implementing the hook. This ensures the API serves the caller.
>
> 2. **Design for change** — what will users likely need in 6 months? Build extension points now.
>
> 3. **Progressive disclosure** — simple usage should be simple. Complex usage should be possible. The API should not force complexity on simple cases.
>
> 4. **Return types are your contract** — use TypeScript's `as const` and `ReturnType<typeof useX>` to let consumers use your return types.
>
> 5. **Never break callers** — if you need to change the API, add to it (new options with defaults), don't remove or rename.

---

# 7. Async Hooks and Data Fetching

## 7.1 Mental Model

> **Mental Model**: An async hook is a **state machine** with states: `idle → loading → success | error`. Each transition triggers a re-render. Your job is to manage these transitions cleanly and handle edge cases (stale responses, unmounted components, race conditions).

## 7.2 The Request Lifecycle

```
User Action / Mount
       ↓
  [idle state]
       ↓
  trigger fetch
       ↓
  [loading state] ← component shows spinner
       ↓
  Response arrives
       ↓
   ┌─── success ───→ [data state] ← component shows data
   │
   └─── error ─────→ [error state] ← component shows error UI
                             ↓
                        retry? ─→ back to loading
```

## 7.3 The Base useFetch Hook

```typescript
// hooks/useFetch.ts
import { useState, useEffect, useRef, useCallback } from 'react';

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface FetchState<T> {
  data: T | null;
  error: Error | null;
  status: FetchStatus;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
}

export interface UseFetchOptions<T> {
  enabled?: boolean;
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  select?: (data: T) => T; // Transform data before storing
}

export function useFetch<T>(
  url: string | null,
  options: UseFetchOptions<T> = {}
): FetchState<T> & { refetch: () => void } {
  const {
    enabled = true,
    initialData,
    onSuccess,
    onError,
    select,
  } = options;

  const [state, setState] = useState<FetchState<T>>({
    data: initialData ?? null,
    error: null,
    status: 'idle',
    isLoading: false,
    isSuccess: false,
    isError: false,
    isIdle: true,
  });

  // Stable refs for callbacks — no stale closures
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const selectRef = useRef(select);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  selectRef.current = select;

  // Trigger counter for manual refetch
  const [fetchCount, setFetchCount] = useState(0);

  const refetch = useCallback(() => setFetchCount(c => c + 1), []);

  useEffect(() => {
    if (!url || !enabled) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        isLoading: false,
        isIdle: true,
        isSuccess: false,
        isError: false,
      }));
      return;
    }

    const controller = new AbortController();

    setState(prev => ({
      ...prev,
      status: 'loading',
      isLoading: true,
      isIdle: false,
      isSuccess: false,
      isError: false,
      error: null,
    }));

    fetch(url, { signal: controller.signal })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        return response.json() as Promise<T>;
      })
      .then(rawData => {
        const data = selectRef.current ? selectRef.current(rawData) : rawData;
        setState({
          data,
          error: null,
          status: 'success',
          isLoading: false,
          isSuccess: true,
          isError: false,
          isIdle: false,
        });
        onSuccessRef.current?.(data);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        const error = err instanceof Error ? err : new Error(String(err));
        setState({
          data: null,
          error,
          status: 'error',
          isLoading: false,
          isSuccess: false,
          isError: true,
          isIdle: false,
        });
        onErrorRef.current?.(error);
      });

    return () => {
      controller.abort();
    };
  }, [url, enabled, fetchCount]);

  return { ...state, refetch };
}
```

## 7.4 Race Conditions — The Critical Problem

```typescript
// ❌ CLASSIC RACE CONDITION:
// User types "r" → fetches "r"
// User types "re" → fetches "re"  
// "re" response comes back first (faster server)
// "r" response comes back second
// Component shows "r" results even though user typed "re"

function useBadSearch(query: string) {
  const [results, setResults] = useState([]);
  
  useEffect(() => {
    fetch(`/api/search?q=${query}`)
      .then(r => r.json())
      .then(data => setResults(data)); // ❌ Last response wins — wrong!
  }, [query]);
  
  return results;
}

// ✅ FIX 1: AbortController (cancels the in-flight request)
function useSearch(query: string) {
  const [results, setResults] = useState([]);
  
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    
    fetch(`/api/search?q=${query}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setResults(data))
      .catch(err => { if (err.name !== 'AbortError') throw err; });
    
    return () => controller.abort(); // Cancels previous request on new query
  }, [query]);
  
  return results;
}

// ✅ FIX 2: Ignore stale responses (when abort isn't possible)
function useSearchWithIgnore(query: string) {
  const [results, setResults] = useState([]);
  
  useEffect(() => {
    let cancelled = false;
    
    fetch(`/api/search?q=${query}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setResults(data); // Only update if still relevant
      });
    
    return () => { cancelled = true; }; // Mark as stale
  }, [query]);
  
  return results;
}
```

## 7.5 Production-Grade Data Fetching Hook with Retry

```typescript
// hooks/useQuery.ts — a simplified React Query-like hook

interface RetryConfig {
  count: number;
  delay: (attempt: number) => number; // Exponential backoff
}

interface UseQueryOptions<T> {
  enabled?: boolean;
  retry?: number | RetryConfig;
  staleTime?: number;       // How long before data is considered stale (ms)
  cacheKey?: string;        // Override default cache key
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  select?: (data: unknown) => T;
  placeholderData?: T;
}

// Simple in-memory cache (production would use a proper cache manager)
const queryCache = new Map<string, { data: unknown; timestamp: number }>();

function useQuery<T>(
  key: string | (string | number | boolean)[],
  fetcher: () => Promise<T>,
  options: UseQueryOptions<T> = {}
) {
  const {
    enabled = true,
    retry = 3,
    staleTime = 0,
    onSuccess,
    onError,
    select,
    placeholderData,
  } = options;

  const cacheKey = Array.isArray(key) ? key.join(':') : key;
  
  const retryConfig: RetryConfig = typeof retry === 'number'
    ? { count: retry, delay: (attempt) => Math.min(1000 * 2 ** attempt, 30000) }
    : retry;

  const [state, setState] = useState<{
    data: T | undefined;
    error: Error | null;
    status: 'idle' | 'loading' | 'success' | 'error';
    fetchedAt: number | null;
  }>(() => {
    // Check cache on init
    const cached = queryCache.get(cacheKey);
    if (cached && staleTime > 0 && Date.now() - cached.timestamp < staleTime) {
      const data = select ? select(cached.data) : (cached.data as T);
      return { data, error: null, status: 'success', fetchedAt: cached.timestamp };
    }
    return { data: placeholderData, error: null, status: 'idle', fetchedAt: null };
  });

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const refetch = useCallback(() => setRefetchTrigger(t => t + 1), []);

  useEffect(() => {
    if (!enabled) return;

    // Check if cached data is still fresh
    const cached = queryCache.get(cacheKey);
    if (cached && staleTime > 0 && Date.now() - cached.timestamp < staleTime) {
      return; // Data is fresh, skip fetch
    }

    let cancelled = false;
    let attempt = 0;

    const execute = async (): Promise<void> => {
      setState(prev => ({
        ...prev,
        status: 'loading',
        error: null,
      }));

      try {
        const rawData = await fetcherRef.current();
        if (cancelled) return;

        const data = select ? select(rawData) : rawData;
        const fetchedAt = Date.now();

        // Update cache
        queryCache.set(cacheKey, { data: rawData, timestamp: fetchedAt });

        setState({ data: data as T, error: null, status: 'success', fetchedAt });
        onSuccessRef.current?.(data as T);
      } catch (err) {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error(String(err));

        if (attempt < retryConfig.count) {
          attempt++;
          const delay = retryConfig.delay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          if (!cancelled) return execute();
        }

        setState(prev => ({ ...prev, error, status: 'error' }));
        onErrorRef.current?.(error);
      }
    };

    execute();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled, staleTime, refetchTrigger]);

  const isStale = state.fetchedAt !== null && staleTime > 0
    ? Date.now() - state.fetchedAt > staleTime
    : false;

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    isStale,
    refetch,
  };
}
```

## 7.6 What Would Break in Production?

1. **The cache is module-level** — it persists across page navigations in SPAs, potentially showing stale data from a previous session. Solution: invalidate on logout, or use session-scoped cache.

2. **No request deduplication** — if three components call `useQuery(['user', id], ...)` simultaneously, you get three network requests. React Query solves this. Solution: implement an in-flight request registry.

3. **The `staleTime` check uses `Date.now()` at render time** — if the user's computer clock is wrong, this breaks. Use server timestamps where critical.

4. **No background refetch on window focus** — data can be stale after the user switches tabs. React Query refetches on focus by default.

---

# 8. Mutation Hooks

## 8.1 Mental Model

> **Mental Model**: A mutation hook is like a **form submission** abstraction. It manages the async state of a write operation (create, update, delete) separately from your read state. Its lifecycle is: `idle → submitting → success | error`.

## 8.2 The Base useMutation Hook

```typescript
// hooks/useMutation.ts

interface MutationState<TData, TError = Error> {
  data: TData | null;
  error: TError | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
}

interface UseMutationOptions<TData, TVariables, TError = Error> {
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void;
  onSettled?: (
    data: TData | null,
    error: TError | null,
    variables: TVariables
  ) => void;
}

export function useMutation<TData, TVariables, TError = Error>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables, TError> = {}
) {
  const [state, setState] = useState<MutationState<TData, TError>>({
    data: null,
    error: null,
    status: 'idle',
    isLoading: false,
    isSuccess: false,
    isError: false,
    isIdle: true,
  });

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      status: 'idle',
      isLoading: false,
      isSuccess: false,
      isError: false,
      isIdle: true,
    });
  }, []);

  const mutate = useCallback(async (variables: TVariables) => {
    setState({
      data: null,
      error: null,
      status: 'loading',
      isLoading: true,
      isSuccess: false,
      isError: false,
      isIdle: false,
    });

    try {
      const data = await mutationFnRef.current(variables);
      
      setState({
        data,
        error: null,
        status: 'success',
        isLoading: false,
        isSuccess: true,
        isError: false,
        isIdle: false,
      });

      await optionsRef.current.onSuccess?.(data, variables);
      optionsRef.current.onSettled?.(data, null, variables);
      
      return data;
    } catch (err) {
      const error = (err instanceof Error ? err : new Error(String(err))) as TError;
      
      setState({
        data: null,
        error,
        status: 'error',
        isLoading: false,
        isSuccess: false,
        isError: true,
        isIdle: false,
      });

      optionsRef.current.onError?.(error, variables);
      optionsRef.current.onSettled?.(null, error, variables);
      
      throw error; // Re-throw so caller can handle
    }
  }, []);

  // mutateAsync is the same as mutate but returns a promise
  // (mutate swallows errors to prevent unhandled rejection warnings)
  const mutateAsync = mutate;

  const mutateSafe = useCallback(async (variables: TVariables) => {
    try {
      return await mutate(variables);
    } catch {
      // Swallow — error is available in state
    }
  }, [mutate]);

  return {
    ...state,
    mutate: mutateSafe,
    mutateAsync,
    reset,
  };
}
```

## 8.3 Real-World Example — useCreatePost

```typescript
// services/postService.ts
interface CreatePostInput {
  title: string;
  body: string;
  tags: string[];
}

interface Post extends CreatePostInput {
  id: string;
  authorId: string;
  createdAt: string;
}

const postService = {
  create: (input: CreatePostInput): Promise<Post> =>
    fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then(r => {
      if (!r.ok) throw new Error(`Failed: ${r.statusText}`);
      return r.json();
    }),
};

// hooks/useCreatePost.ts
function useCreatePost() {
  const { invalidate } = useQueryCache(); // Fictional cache invalidation
  const { addToast } = useToast();
  
  return useMutation(postService.create, {
    onSuccess: (post) => {
      invalidate(['posts']); // Refresh post list
      addToast({ type: 'success', message: `"${post.title}" published!` });
    },
    onError: (error) => {
      addToast({ type: 'error', message: error.message });
    },
  });
}

// Usage in component
function CreatePostForm() {
  const { mutate: createPost, isLoading, error } = useCreatePost();
  const form = useForm<CreatePostInput>(); // See form hooks section
  
  const onSubmit = form.handleSubmit(async (data) => {
    await createPost(data);
    form.reset();
  });
  
  return (
    <form onSubmit={onSubmit}>
      {/* fields */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Publishing...' : 'Publish'}
      </button>
      {error && <ErrorMessage error={error} />}
    </form>
  );
}
```

---

# 9. Caching, Optimistic Updates, Retry

## 9.1 Optimistic Updates Pattern

> **Mental Model**: Assume the server will succeed. Update the UI immediately. Roll back if it doesn't. This is how WhatsApp shows your message before the server confirms it.

```typescript
// hooks/useOptimisticList.ts

interface UseOptimisticListOptions<T, TId extends keyof T> {
  items: T[];
  idKey: TId;
  onAdd?: (item: T) => Promise<T>;
  onRemove?: (id: T[TId]) => Promise<void>;
  onUpdate?: (id: T[TId], updates: Partial<T>) => Promise<T>;
}

function useOptimisticList<T extends object, TId extends keyof T>({
  items: serverItems,
  idKey,
  onAdd,
  onRemove,
  onUpdate,
}: UseOptimisticListOptions<T, TId>) {
  // Track pending optimistic changes
  const [optimisticItems, setOptimisticItems] = useState<T[]>(serverItems);
  const [pendingIds, setPendingIds] = useState<Set<T[TId]>>(new Set());
  const [errorIds, setErrorIds] = useState<Map<T[TId], Error>>(new Map());

  // Keep in sync with server items (non-pending)
  useEffect(() => {
    setOptimisticItems(prev => {
      // Merge: keep pending items, update non-pending from server
      const pending = prev.filter(item => pendingIds.has(item[idKey]));
      const nonPending = serverItems.filter(item => !pendingIds.has(item[idKey]));
      return [...nonPending, ...pending];
    });
  }, [serverItems, pendingIds, idKey]);

  const addItem = useCallback(async (item: T) => {
    if (!onAdd) return;

    // Optimistically add
    setOptimisticItems(prev => [item, ...prev]);
    setPendingIds(prev => new Set(prev).add(item[idKey]));

    try {
      const serverItem = await onAdd(item);
      
      // Replace optimistic with server version
      setOptimisticItems(prev =>
        prev.map(i => i[idKey] === item[idKey] ? serverItem : i)
      );
    } catch (err) {
      // Rollback
      setOptimisticItems(prev => prev.filter(i => i[idKey] !== item[idKey]));
      setErrorIds(prev => new Map(prev).set(item[idKey], err as Error));
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(item[idKey]);
        return next;
      });
    }
  }, [onAdd, idKey]);

  const removeItem = useCallback(async (id: T[TId]) => {
    if (!onRemove) return;

    const removed = optimisticItems.find(i => i[idKey] === id);
    
    // Optimistically remove
    setOptimisticItems(prev => prev.filter(i => i[idKey] !== id));
    setPendingIds(prev => new Set(prev).add(id));

    try {
      await onRemove(id);
    } catch (err) {
      // Rollback
      if (removed) {
        setOptimisticItems(prev => [...prev, removed]);
      }
      setErrorIds(prev => new Map(prev).set(id, err as Error));
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [onRemove, optimisticItems, idKey]);

  return {
    items: optimisticItems,
    addItem,
    removeItem,
    isPending: (id: T[TId]) => pendingIds.has(id),
    getError: (id: T[TId]) => errorIds.get(id),
  };
}
```

## 9.2 Retry with Exponential Backoff

```typescript
// hooks/useRetry.ts

interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

function useRetry(options: RetryOptions = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    shouldRetry = () => true,
  } = options;

  const [attempt, setAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const withRetry = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    let currentAttempt = 0;

    while (true) {
      try {
        setAttempt(currentAttempt);
        const result = await fn();
        setAttempt(0);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        currentAttempt++;

        if (currentAttempt >= maxAttempts || !shouldRetry(error, currentAttempt)) {
          throw error;
        }

        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, currentAttempt - 1),
          maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitter = Math.random() * delay * 0.1;
        
        setIsRetrying(true);
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        setIsRetrying(false);
      }
    }
  }, [maxAttempts, baseDelay, maxDelay, backoffFactor, shouldRetry]);

  return { withRetry, attempt, isRetrying, maxAttempts };
}

// Usage
function useResilientFetch<T>(url: string) {
  const { withRetry } = useRetry({
    maxAttempts: 3,
    shouldRetry: (error) => !error.message.includes('401'), // Don't retry auth errors
  });

  const { data, error, isLoading, refetch } = useFetch<T>(url);

  const resilientFetch = useCallback(
    () => withRetry(() => fetch(url).then(r => r.json())),
    [url, withRetry]
  );

  return { data, error, isLoading, retry: resilientFetch };
}
```

---

# 10. Pagination and Infinite Scroll Hooks

## 10.1 usePagination — Full Implementation

```typescript
// hooks/usePaginatedQuery.ts

interface Page<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface UsePaginatedQueryOptions<T> {
  pageSize?: number;
  initialPage?: number;
  fetcher: (page: number, pageSize: number) => Promise<Page<T>>;
}

function usePaginatedQuery<T>({
  pageSize = 10,
  initialPage = 1,
  fetcher,
}: UsePaginatedQueryOptions<T>) {
  const [page, setPage] = useState(initialPage);
  const [pageData, setPageData] = useState<Map<number, T[]>>(new Map());
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetcherRef.current(page, pageSize)
      .then(result => {
        if (controller.signal.aborted) return;
        setPageData(prev => new Map(prev).set(page, result.data));
        setTotal(result.total);
        setIsLoading(false);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(err);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [page, pageSize]);

  const totalPages = Math.ceil(total / pageSize);
  const currentData = pageData.get(page) ?? [];

  return {
    data: currentData,
    isLoading,
    error,
    page,
    totalPages,
    total,
    pageSize,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    goToPage: setPage,
    nextPage: () => setPage(p => Math.min(p + 1, totalPages)),
    prevPage: () => setPage(p => Math.max(p - 1, 1)),
    prefetchedPages: pageData.size,
  };
}
```

## 10.2 useInfiniteScroll — Production Implementation

```typescript
// hooks/useInfiniteScroll.ts

interface InfiniteScrollState<T> {
  items: T[];
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  error: Error | null;
}

interface UseInfiniteScrollOptions<T> {
  fetcher: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null }>;
  threshold?: number;  // px from bottom to trigger load
}

function useInfiniteScroll<T>({
  fetcher,
  threshold = 200,
}: UseInfiniteScrollOptions<T>) {
  const [state, setState] = useState<InfiniteScrollState<T>>({
    items: [],
    isLoading: false,
    isFetchingMore: false,
    hasMore: true,
    error: null,
  });

  const cursorRef = useRef<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const isFetchingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !state.hasMore) return;
    
    isFetchingRef.current = true;
    const isInitial = state.items.length === 0;

    setState(prev => ({
      ...prev,
      isLoading: isInitial,
      isFetchingMore: !isInitial,
      error: null,
    }));

    try {
      const { items, nextCursor } = await fetcherRef.current(cursorRef.current);
      cursorRef.current = nextCursor;

      setState(prev => ({
        ...prev,
        items: [...prev.items, ...items],
        isLoading: false,
        isFetchingMore: false,
        hasMore: nextCursor !== null,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isFetchingMore: false,
        error: err instanceof Error ? err : new Error(String(err)),
      }));
    } finally {
      isFetchingRef.current = false;
    }
  }, [state.hasMore, state.items.length]);

  // Scroll sentinel using IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && state.hasMore && !isFetchingRef.current) {
          loadMore();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    observerRef.current.observe(sentinel);

    return () => observerRef.current?.disconnect();
  }, [loadMore, state.hasMore, threshold]);

  // Initial load
  useEffect(() => {
    loadMore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    cursorRef.current = null;
    isFetchingRef.current = false;
    setState({
      items: [],
      isLoading: false,
      isFetchingMore: false,
      hasMore: true,
      error: null,
    });
  }, []);

  return {
    ...state,
    sentinelRef,  // Attach to a div at the bottom of your list
    loadMore,
    reset,
  };
}

// ──── Usage ───────────────────────────────────────────────
function PostFeed() {
  const { items: posts, isLoading, isFetchingMore, error, sentinelRef } =
    useInfiniteScroll({
      fetcher: (cursor) => postService.getPosts({ cursor, limit: 20 }),
    });

  if (isLoading) return <FeedSkeleton />;
  if (error) return <ErrorState error={error} />;

  return (
    <div>
      {posts.map(post => <PostCard key={post.id} post={post} />)}
      
      {/* Sentinel — IntersectionObserver watches this element */}
      <div ref={sentinelRef} style={{ height: 1 }} />
      
      {isFetchingMore && <LoadingSpinner />}
    </div>
  );
}
```

## 10.3 Performance Consideration — Virtual Scrolling

For very long lists (1000+ items), rendering all DOM nodes is expensive. The infinite scroll hook above needs a virtual scrolling layer:

```typescript
// The sentinelRef pattern above pairs well with react-virtual or @tanstack/virtual
// Conceptual integration:
function VirtualizedFeed() {
  const { items, sentinelRef, isFetchingMore } = useInfiniteScroll({ fetcher });
  
  // @tanstack/virtual handles DOM virtualization
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
  });

  return (
    <div ref={scrollRef} style={{ height: '100vh', overflowY: 'auto' }}>
      <div style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map(vRow => (
          <div key={vRow.key} style={{ transform: `translateY(${vRow.start}px)` }}>
            <PostCard post={items[vRow.index]} />
          </div>
        ))}
      </div>
      <div ref={sentinelRef} />
      {isFetchingMore && <Spinner />}
    </div>
  );
}
```

---

## Section 7-10 Senior Challenge

**Build a `useDataTable` hook** that composes:
- `usePaginatedQuery` for data
- `useSearch` with debounce for filtering
- `useSort` for column sorting
- `useMutation` for row actions (delete, update inline)
- Optimistic updates for delete
- URL sync (query params reflect table state)

Your hook should support:
```typescript
const table = useDataTable({
  fetcher: userService.list,
  pageSize: 25,
  defaultSort: { field: 'createdAt', direction: 'desc' },
  searchFields: ['name', 'email'],
});

// Consumer uses:
table.data           // Current page data
table.pagination     // Page controls
table.sort          // Sort state and handlers
table.search        // Search state and handlers
table.deleteRow     // Mutation with optimistic update
table.isLoading
```

**FAANG-Level Thought**: At Google scale, this hook would also need: server-side sorting/filtering (not client-side), request cancellation on each filter change, URL-based state for shareability, keyboard navigation support, and SSR compatibility for initial server-rendered state. The architecture decision between client-side and server-side processing determines whether you need AbortController patterns or can get away with simple local filtering.

---

*End of Volume 1 — Continue in react-hooks-mastery-vol2.md*
