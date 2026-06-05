import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, set, update, get, remove, onValue, query as rtdbQuery, orderByChild, limitToLast, limitToFirst } from 'firebase/database';

// Custom user config for "club-fire-11"
const firebaseConfig = {
  apiKey: "AIzaSyDsDwx3pB3Eg-vb8C6t8wOQDOdON8N5Yqo",
  authDomain: "club-fire-11.firebaseapp.com",
  databaseURL: "https://club-fire-11-default-rtdb.firebaseio.com",
  projectId: "club-fire-11",
  storageBucket: "club-fire-11.firebasestorage.app",
  messagingSenderId: "519098949332",
  appId: "1:519098949332:web:563a47157dd9e5ba50a541",
  measurementId: "G-E2DPEL6DP5"
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const db = rtdb; // Alias db to rtdb for backward compatibility
export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to concatenate path segments nicely
function cleanPath(...segments: string[]) {
  return segments.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export interface DocRef {
  type: 'doc';
  path: string;
}

export interface CollectionRef {
  type: 'collection';
  path: string;
}

export interface QueryRef {
  type: 'query';
  path: string;
  rules: any[];
}

export function doc(dbObj: any, pathOrCollection: string | { path: string }, ...segments: string[]): DocRef {
  const startPath = typeof pathOrCollection === 'string' ? pathOrCollection : pathOrCollection.path;
  const finalPath = cleanPath(startPath, ...segments);
  return { type: 'doc', path: finalPath };
}

export function collection(dbObj: any, path: string, ...segments: string[]): CollectionRef {
  return { type: 'collection', path: cleanPath(path, ...segments) };
}

export async function setDoc(docRef: DocRef, data: any, options?: any) {
  const dbRef = ref(rtdb, docRef.path);
  if (options?.merge) {
    return update(dbRef, data);
  }
  return set(dbRef, data);
}

export async function updateDoc(docRef: DocRef, data: any) {
  const dbRef = ref(rtdb, docRef.path);
  return update(dbRef, data);
}

export async function deleteDoc(docRef: DocRef) {
  const dbRef = ref(rtdb, docRef.path);
  return remove(dbRef);
}

export async function getDoc(docRef: DocRef) {
  const dbRef = ref(rtdb, docRef.path);
  const snapshot = await get(dbRef);
  return {
    exists: () => snapshot.exists(),
    data: () => snapshot.val(),
    id: docRef.path.split('/').pop() || ''
  };
}

export function query(collectionRef: CollectionRef, ...rules: any[]): QueryRef {
  return {
    type: 'query',
    path: collectionRef.path,
    rules: rules
  };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(value: number) {
  return { type: 'limit', value };
}

export function queryEqual(a: any, b: any): boolean {
  return a?.path === b?.path;
}

export async function getDocs(queryRef: QueryRef | CollectionRef) {
  const path = queryRef.path;
  const dbRef = ref(rtdb, path);

  let rtdbQueryRef: any = dbRef;
  if (queryRef.type === 'query') {
    const qRef = queryRef as QueryRef;
    let queryConstraints: any[] = [];
    let sortField: string | null = null;

    for (const rule of qRef.rules) {
      if (rule.type === 'orderBy') {
        sortField = rule.field;
      }
    }

    if (sortField) {
      queryConstraints.push(orderByChild(sortField));
    }

    rtdbQueryRef = rtdbQuery(dbRef, ...queryConstraints);
  }

  const snapshot = await get(rtdbQueryRef);
  const docSnaps: any[] = [];
  snapshot.forEach((childSnap) => {
    docSnaps.push({
      exists: () => childSnap.exists(),
      data: () => childSnap.val(),
      id: childSnap.key || ''
    });
  });

  if (queryRef.type === 'query') {
    const qRef = queryRef as QueryRef;
    const orderByRule = qRef.rules.find(r => r.type === 'orderBy');
    if (orderByRule) {
      const field = orderByRule.field;
      const direction = orderByRule.direction || 'asc';
      docSnaps.sort((a, b) => {
        const valA = a.data()?.[field] ?? 0;
        const valB = b.data()?.[field] ?? 0;
        if (direction === 'desc') {
          return valB > valA ? 1 : valB < valA ? -1 : 0;
        } else {
          return valA > valB ? 1 : valA < valB ? -1 : 0;
        }
      });
    }
    const limitRule = qRef.rules.find(r => r.type === 'limit');
    if (limitRule) {
      docSnaps.splice(limitRule.value);
    }
  }

  return {
    forEach: (callback: (doc: any) => void) => {
      docSnaps.forEach(callback);
    },
    docs: docSnaps,
    size: docSnaps.length,
    empty: docSnaps.length === 0
  };
}

export function onSnapshot(
  refOrQuery: DocRef | CollectionRef | QueryRef,
  next: (snapshot: any) => void,
  error?: (error: any) => void
) {
  const path = refOrQuery.path;
  const dbRef = ref(rtdb, path);

  let rtdbQueryRef: any = dbRef;
  if (refOrQuery.type === 'query') {
    const qRef = refOrQuery as QueryRef;
    let queryConstraints: any[] = [];
    let sortField: string | null = null;
    let limitCount: number | null = null;

    for (const rule of qRef.rules) {
      if (rule.type === 'orderBy') {
        sortField = rule.field;
      } else if (rule.type === 'limit') {
        limitCount = rule.value;
      }
    }

    if (sortField) {
      queryConstraints.push(orderByChild(sortField));
    }
    if (limitCount !== null) {
      queryConstraints.push(limitToLast(limitCount));
    }

    rtdbQueryRef = rtdbQuery(dbRef, ...queryConstraints);
  }

  const unsubscribe = onValue(rtdbQueryRef, (snapshot) => {
    if (refOrQuery.type === 'doc') {
      const docSnap = {
        exists: () => snapshot.exists(),
        data: () => snapshot.val(),
        id: path.split('/').pop() || ''
      };
      next(docSnap);
    } else {
      const docSnaps: any[] = [];
      snapshot.forEach((childSnap) => {
        docSnaps.push({
          exists: () => childSnap.exists(),
          data: () => childSnap.val(),
          id: childSnap.key || ''
        });
      });

      if (refOrQuery.type === 'query') {
        const qRef = refOrQuery as QueryRef;
        const orderByRule = qRef.rules.find(r => r.type === 'orderBy');
        if (orderByRule) {
          const field = orderByRule.field;
          const direction = orderByRule.direction || 'asc';
          docSnaps.sort((a, b) => {
            const valA = a.data()?.[field] ?? 0;
            const valB = b.data()?.[field] ?? 0;
            if (direction === 'desc') {
              return valB > valA ? 1 : valB < valA ? -1 : 0;
            } else {
              return valA > valB ? 1 : valA < valB ? -1 : 0;
            }
          });
        }
        const limitRule = qRef.rules.find(r => r.type === 'limit');
        if (limitRule) {
          docSnaps.splice(limitRule.value);
        }
      }

      const colSnap = {
        forEach: (callback: (doc: any) => void) => {
          docSnaps.forEach(callback);
        },
        docs: docSnaps,
        size: docSnaps.length,
        empty: docSnaps.length === 0
      };
      next(colSnap);
    }
  }, (err) => {
    if (error) error(err);
  });

  return unsubscribe;
}
