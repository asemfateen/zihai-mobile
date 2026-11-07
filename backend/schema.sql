PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dictionary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  traditional TEXT NOT NULL,
  simplified TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  definitions TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  english_definition TEXT NOT NULL,
  hsk_level INTEGER,
  pinyin_search TEXT,
  pinyin_normalized TEXT,
  pinyin_display TEXT,
  pinyin_plain TEXT,
  radical INTEGER,
  stroke_count INTEGER,
  traditional TEXT,
  frequency_rank INTEGER,
  example_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_words_pinyin_normalized ON words(pinyin_normalized);
CREATE INDEX IF NOT EXISTS idx_words_character ON words(character);
CREATE INDEX IF NOT EXISTS idx_words_english_definition ON words(english_definition);
CREATE INDEX IF NOT EXISTS idx_words_pinyin_plain ON words(pinyin_plain);
CREATE INDEX IF NOT EXISTS idx_words_frequency ON words(frequency_rank);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  display_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_word ON favorites(user_id, word_id);

CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  query TEXT NOT NULL,
  searched_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, searched_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_history_unique ON search_history(user_id, query);



CREATE TABLE IF NOT EXISTS flashcard_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  elapsed_days INTEGER DEFAULT 0,
  scheduled_days INTEGER DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  state INTEGER DEFAULT 0,
  last_review_date TEXT,
  next_review_date TEXT DEFAULT (date('now')),
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,
  UNIQUE(user_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_flashcard_due ON flashcard_progress(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_flashcard_user ON flashcard_progress(user_id, word_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

CREATE TABLE IF NOT EXISTS radicals (
  id INTEGER PRIMARY KEY,
  character TEXT NOT NULL,
  name TEXT
);

CREATE TABLE IF NOT EXISTS word_examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id INTEGER NOT NULL,
  sentence TEXT NOT NULL,
  translation TEXT
);

CREATE INDEX IF NOT EXISTS idx_word_examples_word ON word_examples(word_id);

CREATE TABLE IF NOT EXISTS review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  review_date TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_review_log_user_date ON review_log(user_id, review_date);

CREATE TABLE IF NOT EXISTS reading_stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  hsk_level INTEGER NOT NULL,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS custom_list_words (
  list_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (list_id, word_id),
  FOREIGN KEY (list_id) REFERENCES custom_lists(id) ON DELETE CASCADE
);
