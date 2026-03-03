-- V16: Fix BCrypt hash prefix from $2b$ to $2a$ for Spring Security compatibility.
-- Spring's BCryptPasswordEncoder expects $2a$; $2b$ is cryptographically identical
-- but may not be recognized by all versions.

UPDATE app_user
   SET password_hash = OVERLAY(password_hash PLACING '2a' FROM 2 FOR 2)
 WHERE password_hash LIKE '$2b$%';
