use std::io::{BufRead, Write};
use std::path::PathBuf;
use std::sync::Mutex;

/// Lightweight metadata for history listing.
/// Full pipeline results are stored separately as `{id}_result.json`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub created_at: i64,
    pub source: String,
    pub url: String,
    pub title: String,
    pub bvid: String,
    pub uploader: String,
    pub duration: i64,
    pub cover: String,
    pub summary: String,
    pub elapsed_ms: i64,
    pub template_name: String,
    pub status: String,
    pub error_msg: String,
}

/// Paginated response for history listing.
#[derive(Debug, Clone, serde::Serialize)]
pub struct HistoryListResult {
    pub entries: Vec<HistoryEntry>,
    pub total: usize,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
}

pub struct HistoryStore {
    entries: Vec<HistoryEntry>,
    bytes_written: u64,
    data_dir: PathBuf,
}

impl HistoryStore {
    pub fn load(data_dir: PathBuf) -> Self {
        let jsonl_path = data_dir.join("history.jsonl");
        let mut entries: Vec<HistoryEntry> = Vec::new();

        if jsonl_path.exists() {
            if let Ok(file) = std::fs::File::open(&jsonl_path) {
                let reader = std::io::BufReader::new(file);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        if line.trim().is_empty() || line.trim().starts_with("//") {
                            continue;
                        }
                        if let Ok(entry) = serde_json::from_str::<HistoryEntry>(&line) {
                            entries.push(entry);
                        }
                    }
                }
            }
        }

        let bytes_written = std::fs::metadata(&jsonl_path)
            .map(|m| m.len())
            .unwrap_or(0);

        let results_dir = data_dir.join("results");
        let _ = std::fs::create_dir_all(&results_dir);

        HistoryStore {
            entries,
            bytes_written,
            data_dir,
        }
    }

    /// Append entry metadata and full result to persistent storage.
    pub fn add(&mut self, entry: HistoryEntry, full_result_json: &str) -> std::io::Result<()> {
        // Ensure parent directories exist before writing
        let _ = std::fs::create_dir_all(&self.data_dir);
        let _ = std::fs::create_dir_all(self.data_dir.join("results"));

        let jsonl_path = self.data_dir.join("history.jsonl");

        let line = serde_json::to_string(&entry).unwrap_or_default();
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&jsonl_path)?;
        writeln!(file, "{}", line)?;
        self.bytes_written += line.len() as u64 + 1;

        let result_path = self.data_dir.join("results").join(format!("{}.json", entry.id));
        std::fs::write(&result_path, full_result_json)?;

        self.entries.push(entry);
        Ok(())
    }

    pub fn list(&self, page: u32, page_size: u32, search: Option<&str>) -> HistoryListResult {
        let filtered: Vec<&HistoryEntry> = if let Some(q) = search.filter(|s| !s.is_empty()) {
            let q = q.to_lowercase();
            self.entries
                .iter()
                .filter(|e| {
                    e.title.to_lowercase().contains(&q)
                        || e.uploader.to_lowercase().contains(&q)
                        || e.bvid.to_lowercase().contains(&q)
                })
                .collect()
        } else {
            self.entries.iter().collect()
        };

        let total = filtered.len();
        let total_pages = if total == 0 {
            0
        } else {
            ((total as f64) / (page_size as f64)).ceil() as u32
        };
        let start = ((page.saturating_sub(1)) as usize) * (page_size as usize);
        let end = (start + page_size as usize).min(total);

        let entries: Vec<HistoryEntry> = filtered[start..end]
            .iter()
            .map(|e| (*e).clone())
            .collect();

        HistoryListResult {
            entries,
            total,
            page,
            page_size,
            total_pages,
        }
    }

    pub fn get_result(&self, id: &str) -> Option<String> {
        let result_path = self.data_dir.join("results").join(format!("{}.json", id));
        std::fs::read_to_string(&result_path).ok()
    }

    pub fn delete(&mut self, id: &str) -> std::io::Result<bool> {
        let idx = self.entries.iter().position(|e| e.id == id);
        if let Some(idx) = idx {
            let jsonl_path = self.data_dir.join("history.jsonl");
            let mut file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&jsonl_path)?;
            writeln!(file, "// DELETED {}", id)?;

            let result_path = self.data_dir.join("results").join(format!("{}.json", id));
            let _ = std::fs::remove_file(&result_path);

            self.entries.remove(idx);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn clear(&mut self) -> std::io::Result<usize> {
        let count = self.entries.len();
        let jsonl_path = self.data_dir.join("history.jsonl");
        std::fs::write(&jsonl_path, "")?;
        self.bytes_written = 0;

        let results_dir = self.data_dir.join("results");
        if results_dir.exists() {
            let _ = std::fs::remove_dir_all(&results_dir);
            let _ = std::fs::create_dir_all(&results_dir);
        }

        self.entries.clear();
        Ok(count)
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }
}

pub struct HistoryState(pub Mutex<HistoryStore>);
