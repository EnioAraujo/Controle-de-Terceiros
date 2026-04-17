-- Migration: fix_default_is_approved.sql
-- FIX-01 (SECURITY_FIXES.md): Altera o DEFAULT de is_approved para false.
-- Novos cadastros passam a exigir aprovação manual pelo admin.
-- Usuários existentes com is_approved = true NÃO são afetados.

ALTER TABLE profiles ALTER COLUMN is_approved SET DEFAULT false;
