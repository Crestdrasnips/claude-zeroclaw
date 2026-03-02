use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use chrono::{DateTime, Utc};

/// A stored conversation session mapping an OpenAI-style conversation ID
/// to the Claude CLI session ID (used with --resume).
#[derive(Debug, Clone)]
pub struct Session {
    pub conversation_id: String,
    pub claude_session_id: String,
    pub created_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,
    pub turn_count: u32,
}

/// Thread-safe in-memory session store.
/// In production, back this with Redis or SQLite.
#[derive(Debug, Clone, Default)]
pub struct SessionStore {
    inner: Arc<RwLock<HashMap<String, Session>>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, conversation_id: &str) -> Option<Session> {
        self.inner.read().ok()?.get(conversation_id).cloned()
    }

    pub fn upsert(&self, conversation_id: String, claude_session_id: String) {
        let mut map = self.inner.write().expect("session lock poisoned");
        let entry = map.entry(conversation_id.clone()).or_insert_with(|| Session {
            conversation_id: conversation_id.clone(),
            claude_session_id: claude_session_id.clone(),
            created_at: Utc::now(),
            last_used: Utc::now(),
            turn_count: 0,
        });
        entry.claude_session_id = claude_session_id;
        entry.last_used = Utc::now();
        entry.turn_count += 1;
    }

    pub fn remove(&self, conversation_id: &str) {
        if let Ok(mut map) = self.inner.write() {
            map.remove(conversation_id);
        }
    }

    pub fn len(&self) -> usize {
        self.inner.read().map(|m| m.len()).unwrap_or(0)
    }
}
