-- AIDC 站点配置表（MySQL 8.0+）
-- 用法：mysql -u user -p aidc < sql/schema.sql

CREATE DATABASE IF NOT EXISTS aidc
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE aidc;

CREATE TABLE IF NOT EXISTS app_config (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_key   VARCHAR(64) NOT NULL COMMENT '如 roi.defaults',
  config_json  JSON NOT NULL,
  version      INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by   VARCHAR(64) NULL,
  comment      VARCHAR(255) NULL,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_config_revision (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_key   VARCHAR(64) NOT NULL,
  config_json  JSON NOT NULL,
  version      INT UNSIGNED NOT NULL,
  created_by   VARCHAR(64) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_key_ver (config_key, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
