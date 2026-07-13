export const API_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://money-manager-ai-backend.vercel.app'
    : 'http://localhost:5050'
);
