-- V17: Reset all user passwords to admin123 with $2a$ prefix.
-- This ensures Spring BCryptPasswordEncoder recognizes the hashes on all environments.
-- Hash: BCrypt($2a$, 10 rounds) of "admin123"

UPDATE app_user
   SET password_hash = '$2a$10$VMiaurzj8CUXO4hDov7.nOZMzy2GZOVQiPSl.9vees0loCPwZFDYa';
