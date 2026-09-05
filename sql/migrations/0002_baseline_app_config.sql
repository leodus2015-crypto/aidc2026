-- 基线：站点配置表。新库创建；已有库 CREATE IF NOT EXISTS 不改数据。
-- 前滚：确保 app_config / app_config_revision 存在。回滚：禁止删除已有配置数据。
-- 锁表风险：低。备份：首次在生产执行前备份。

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
