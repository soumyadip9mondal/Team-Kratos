/**
 * Communication Stress-Testing API Client
 *
 * Wraps backend endpoints for stress testing, capabilities, and event tracking.
 * Generates unique UUIDs for Idempotency-Key headers.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getCapabilities() {
  const res = await fetch(`${API_BASE}/api/communication-stress-tests/capabilities`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch stress-testing capabilities.');
  }
  return res.json();
}

export async function createStressTest({ sourceType = 'ANNOUNCEMENT', title, category, message }) {
  const headers = {
    ...getAuthHeaders(),
    'Idempotency-Key': generateUUID(),
  };

  const res = await fetch(`${API_BASE}/api/communication-stress-tests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sourceType, title, category, message }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Stress test failed.');
  }
  return data;
}

export async function getStressTest(id) {
  const res = await fetch(`${API_BASE}/api/communication-stress-tests/${id}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to retrieve stress test.');
  }
  return data;
}

export async function recordEvent(id, { eventType, metadata }) {
  const res = await fetch(`${API_BASE}/api/communication-stress-tests/${id}/events`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ eventType, metadata }),
  });
  return res.json().catch(() => ({}));
}

export async function analyzeAnnouncementForEmployees({ title, message, category }) {
  const res = await fetch(`${API_BASE}/api/communication-stress-tests/analyze-announcement`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title, message, category }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to analyze announcement.');
  }
  return data;
}
