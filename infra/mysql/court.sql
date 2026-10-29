CREATE TABLE IF NOT EXISTS court_cases (
  id CHAR(36) PRIMARY KEY,
  author_id CHAR(36) NOT NULL,
  title VARCHAR(60) NOT NULL,
  story TEXT NOT NULL,
  category VARCHAR(12) NOT NULL,
  demand VARCHAR(120) NOT NULL,
  status ENUM('pending','open','closed','rejected') NOT NULL DEFAULT 'pending',
  resolution VARCHAR(120) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY court_feed (status, created_at, id),
  KEY court_author (author_id, created_at),
  FOREIGN KEY (author_id) REFERENCES app_users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS court_votes (
  case_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  choice ENUM('plaintiff','defendant','peace') NOT NULL,
  PRIMARY KEY (case_id, user_id),
  FOREIGN KEY (case_id) REFERENCES court_cases(id),
  FOREIGN KEY (user_id) REFERENCES app_users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS court_comments (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY court_discussion (case_id, status, created_at),
  KEY court_moderation (status, created_at),
  FOREIGN KEY (case_id) REFERENCES court_cases(id),
  FOREIGN KEY (user_id) REFERENCES app_users(id)
) ENGINE=InnoDB;
