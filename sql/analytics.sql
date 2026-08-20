-- AIDC 访问统计表（基于 Nginx access.log 聚合）
-- 用法：mysql -u user -p aidc < sql/analytics.sql

USE aidc;

CREATE TABLE IF NOT EXISTS analytics_daily (
  day          DATE NOT NULL,
  pv           INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '页面请求（已过滤静态资源）',
  uv           INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '独立 IP 数',
  html_pv      INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'HTML 页面请求',
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_daily_pages (
  day          DATE NOT NULL,
  path         VARCHAR(512) NOT NULL,
  hits         INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (day, path(191)),
  KEY idx_day_hits (day, hits)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_daily_ips (
  day          DATE NOT NULL,
  ip           VARCHAR(45) NOT NULL,
  hits         INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (day, ip),
  KEY idx_day_hits (day, hits)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_daily_status (
  day          DATE NOT NULL,
  status_code  SMALLINT UNSIGNED NOT NULL,
  hits         INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (day, status_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_log_cursor (
  log_path     VARCHAR(512) NOT NULL,
  byte_offset  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  inode        VARCHAR(64) NULL,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (log_path(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
