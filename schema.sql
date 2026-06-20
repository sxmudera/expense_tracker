-- ============================================================
-- Expense Tracker - MySQL Schema
-- UPN Veteran Yogyakarta - Uji Kualitas Perangkat Lunak
-- ============================================================

CREATE DATABASE IF NOT EXISTS expense_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE expense_tracker;

DROP TABLE IF EXISTS expenses;

CREATE TABLE expenses (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(200)      NOT NULL,
  amount          DECIMAL(12, 2)    NOT NULL,
  category        VARCHAR(50)       NOT NULL,
  payment_method  VARCHAR(50)       NOT NULL DEFAULT 'Cash',
  expense_date    DATE              NOT NULL,
  description     VARCHAR(1000)     NULL,
  tags            JSON              NULL,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_category (category),
  INDEX idx_expense_date (expense_date)
) ENGINE = InnoDB;
