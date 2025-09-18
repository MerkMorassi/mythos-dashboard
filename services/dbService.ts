

import type { VoiceOption, TrainingSample } from '../types';

const DB_NAME = 'MythosDB';
const DB_VERSION = 2; // Incremented version to add new store
const VOICE_STORE = 'clonedVoices';
const SAMPLE_STORE = 'trainingSamples';

let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) {
        return resolve(true);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening IndexedDB');
      reject(false);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(VOICE_STORE)) {
        dbInstance.createObjectStore(VOICE_STORE, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(SAMPLE_STORE)) {
        const sampleStore = dbInstance.createObjectStore(SAMPLE_STORE, { keyPath: 'id', autoIncrement: true });
        sampleStore.createIndex('agent_id', 'agent_id', { unique: false });
      }
    };
  });
};

// --- Cloned Voices ---

export const addClonedVoice = (voice: { id: string; name: string; blob: Blob }): Promise<VoiceOption> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');
    const transaction = db.transaction(VOICE_STORE, 'readwrite');
    const store = transaction.objectStore(VOICE_STORE);
    const request = store.put({ id: voice.id, name: voice.name, blob: voice.blob });

    request.onerror = () => {
      console.error('Error adding voice to IndexedDB', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve({ id: voice.id, name: voice.name });
    };
  });
};

export const getClonedVoices = (): Promise<VoiceOption[]> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');
    const transaction = db.transaction(VOICE_STORE, 'readonly');
    const store = transaction.objectStore(VOICE_STORE);
    const request = store.getAll();

    request.onerror = () => {
      console.error('Error fetching voices from IndexedDB', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      const voices = request.result.map(item => ({ id: item.id, name: item.name }));
      resolve(voices);
    };
  });
};

export const getClonedVoiceBlob = (id: string): Promise<Blob | null> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction(VOICE_STORE, 'readonly');
        const store = transaction.objectStore(VOICE_STORE);
        const request = store.get(id);

        request.onerror = () => {
            console.error('Error fetching voice blob from IndexedDB', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result.blob);
            } else {
                resolve(null);
            }
        };
    });
};

// --- Training Samples ---

export const addTrainingSample = (sample: { agent_id: string; filename: string; original_filename: string; blob: Blob }): Promise<TrainingSample> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction(SAMPLE_STORE, 'readwrite');
        const store = transaction.objectStore(SAMPLE_STORE);
        const newSample = {
            ...sample,
            created_at: new Date().toISOString(),
            transcript: null,
        };
        const request = store.add(newSample);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const resultWithId = { ...newSample, id: request.result as number };
            resolve(resultWithId);
        };
    });
};

export const getTrainingSamplesForAgent = (agentId: string): Promise<TrainingSample[]> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction(SAMPLE_STORE, 'readonly');
        const store = transaction.objectStore(SAMPLE_STORE);
        const index = store.index('agent_id');
        const request = index.getAll(agentId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

export const getAllTrainingSamples = (): Promise<TrainingSample[]> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction(SAMPLE_STORE, 'readonly');
        const store = transaction.objectStore(SAMPLE_STORE);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};


export const deleteTrainingSample = (sampleId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction(SAMPLE_STORE, 'readwrite');
        const store = transaction.objectStore(SAMPLE_STORE);
        const request = store.delete(sampleId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

export const updateTrainingSampleTranscript = (sampleId: number, transcript: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction(SAMPLE_STORE, 'readwrite');
        const store = transaction.objectStore(SAMPLE_STORE);
        const getRequest = store.get(sampleId);

        getRequest.onerror = () => reject(getRequest.error);
        getRequest.onsuccess = () => {
            const sample = getRequest.result;
            if (sample) {
                sample.transcript = transcript;
                const putRequest = store.put(sample);
                putRequest.onerror = () => reject(putRequest.error);
                putRequest.onsuccess = () => resolve();
            } else {
                reject(`Sample with ID ${sampleId} not found.`);
            }
        };
    });
};

export const getFirstTrainingSampleBlob = (agentId: string): Promise<Blob | null> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction(SAMPLE_STORE, 'readonly');
        const store = transaction.objectStore(SAMPLE_STORE);
        const index = store.index('agent_id');
        const request = index.openCursor(agentId); // Get a cursor for the agent's samples
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                // Found the first sample
                resolve(cursor.value.blob);
            } else {
                // No samples found for this agent
                resolve(null);
            }
        };
    });
};