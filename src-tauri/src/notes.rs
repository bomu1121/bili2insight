use std::io::{BufRead, Write};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NoteFolder {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    #[serde(default)]
    pub color: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NoteEntry {
    pub id: String,
    pub folder_id: String,
    pub title: String,
    pub content: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct NoteStore {
    folders: Vec<NoteFolder>,
    notes_index: Vec<NoteEntry>,
    data_dir: PathBuf,
}

impl NoteStore {
    pub fn load(data_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&data_dir);
        let _ = fs::create_dir_all(data_dir.join("notes"));

        let mut folders: Vec<NoteFolder> = Vec::new();
        let folders_path = data_dir.join("folders.json");
        if folders_path.exists() {
            if let Ok(contents) = fs::read_to_string(&folders_path) {
                if let Ok(parsed) = serde_json::from_str::<Vec<NoteFolder>>(&contents) {
                    folders = parsed;
                }
            }
        }

        let mut notes_index: Vec<NoteEntry> = Vec::new();
        let notes_dir = data_dir.join("notes");
        if notes_dir.exists() {
            if let Ok(entries) = fs::read_dir(&notes_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map(|e| e == "json").unwrap_or(false) {
                        if let Ok(contents) = fs::read_to_string(&path) {
                            if let Ok(note) = serde_json::from_str::<NoteEntry>(&contents) {
                                notes_index.push(note);
                            }
                        }
                    }
                }
            }
        }

        NoteStore { folders, notes_index, data_dir }
    }

    fn save_folders(&self) -> std::io::Result<()> {
        let json = serde_json::to_string_pretty(&self.folders).unwrap_or_default();
        fs::write(self.data_dir.join("folders.json"), json)
    }

    fn save_note_file(&self, note: &NoteEntry) -> std::io::Result<()> {
        let json = serde_json::to_string_pretty(note).unwrap_or_default();
        fs::write(self.data_dir.join("notes").join(format!("{}.json", note.id)), json)
    }

    pub fn create_folder(&mut self, title: String, color: String) -> std::io::Result<NoteFolder> {
        let folder = NoteFolder {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            created_at: chrono::Utc::now().timestamp_millis(),
            color,
        };
        self.folders.push(folder.clone());
        self.save_folders()?;
        Ok(folder)
    }

    pub fn get_folders(&self) -> Vec<NoteFolder> {
        let mut folders = self.folders.clone();
        folders.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        folders
    }

    pub fn update_folder(&mut self, id: &str, title: Option<String>, color: Option<String>) -> std::io::Result<Option<NoteFolder>> {
        if let Some(folder) = self.folders.iter_mut().find(|f| f.id == id) {
            if let Some(t) = title { folder.title = t; }
            if let Some(c) = color { folder.color = c; }
            let updated = folder.clone();
            self.save_folders()?;
            Ok(Some(updated))
        } else {
            Ok(None)
        }
    }

    pub fn delete_folder(&mut self, id: &str) -> std::io::Result<bool> {
        let idx = self.folders.iter().position(|f| f.id == id);
        if let Some(idx) = idx {
            let note_ids: Vec<String> = self.notes_index.iter()
                .filter(|n| n.folder_id == id)
                .map(|n| n.id.clone())
                .collect();
            for nid in &note_ids {
                let _ = fs::remove_file(self.data_dir.join("notes").join(format!("{}.json", nid)));
            }
            self.notes_index.retain(|n| n.folder_id != id);
            self.folders.remove(idx);
            self.save_folders()?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn create_note(&mut self, folder_id: String, title: String, content: String) -> std::io::Result<NoteEntry> {
        let now = chrono::Utc::now().timestamp_millis();
        let note = NoteEntry {
            id: uuid::Uuid::new_v4().to_string(),
            folder_id,
            title,
            content,
            created_at: now,
            updated_at: now,
        };
        self.save_note_file(&note)?;
        self.notes_index.push(note.clone());
        Ok(note)
    }

    pub fn get_notes(&self, folder_id: &str) -> Vec<NoteEntry> {
        let mut notes: Vec<NoteEntry> = self.notes_index.iter()
            .filter(|n| n.folder_id == folder_id)
            .cloned()
            .collect();
        notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        notes
    }

    pub fn get_note(&self, id: &str) -> Option<NoteEntry> {
        self.notes_index.iter().find(|n| n.id == id).cloned()
    }

    pub fn update_note(&mut self, id: &str, title: Option<String>, content: Option<String>) -> std::io::Result<Option<NoteEntry>> {
        if let Some(note) = self.notes_index.iter_mut().find(|n| n.id == id) {
            if let Some(t) = title { note.title = t; }
            if let Some(c) = content { note.content = c; }
            note.updated_at = chrono::Utc::now().timestamp_millis();
            let updated = note.clone();
            self.save_note_file(&updated)?;
            Ok(Some(updated))
        } else {
            Ok(None)
        }
    }

    pub fn delete_note(&mut self, id: &str) -> std::io::Result<bool> {
        let idx = self.notes_index.iter().position(|n| n.id == id);
        if let Some(idx) = idx {
            let _ = fs::remove_file(self.data_dir.join("notes").join(format!("{}.json", id)));
            self.notes_index.remove(idx);
            Ok(true)
        } else {
            Ok(false)
        }
    }
}

pub struct NoteState(pub Mutex<NoteStore>);
