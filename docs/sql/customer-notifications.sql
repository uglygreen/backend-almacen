CREATE TABLE IF NOT EXISTS device_tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  fcm_token VARCHAR(255) NOT NULL,
  platform VARCHAR(20) NOT NULL,
  device_name VARCHAR(120) NULL,
  app_version VARCHAR(40) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_seen_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_device_tokens_fcm_token (fcm_token),
  KEY idx_device_tokens_customer_active (customer_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  type ENUM('test_push', 'visit_day', 'overdue_invoices') NOT NULL,
  title VARCHAR(140) NOT NULL,
  body VARCHAR(255) NOT NULL,
  dedupe_key VARCHAR(180) NOT NULL,
  metadata_json JSON NULL,
  scheduled_for DATETIME NULL,
  sent_at DATETIME NULL,
  read_at DATETIME NULL,
  deleted_by_user TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  fcm_message_ids JSON NULL,
  error_code VARCHAR(80) NULL,
  error_message VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_customer_notifications_dedupe_key (dedupe_key),
  KEY idx_customer_notifications_customer_created (customer_id, created_at),
  KEY idx_customer_notifications_customer_deleted (customer_id, deleted_by_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE customer_notifications
  MODIFY COLUMN type ENUM('test_push', 'visit_day', 'overdue_invoices') NOT NULL;
