-- 迁移登记表。已有环境执行本文件是幂等的。
-- 前滚：创建 schema_migrations。回滚：DROP TABLE schema_migrations（仅空库或确认无后续迁移记录后）。
-- 锁表风险：低。备份：变更前按运维规范备份 aidc 库。

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename     VARCHAR(255) NOT NULL,
  checksum     CHAR(64) NOT NULL,
  applied_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
